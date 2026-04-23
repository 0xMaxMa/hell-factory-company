#!/usr/bin/env python3
"""LNW XO — Tic-Tac-Toe Telegram bot with crypto payment and payout."""

import asyncio
import copy
import json
import logging
import os
import random
import re
import subprocess
import requests
from pathlib import Path

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
HELL_FACTORY_URL = os.environ.get("HELL_FACTORY_URL", "http://localhost:4200")
HELL_FACTORY_API_KEY = os.environ["HELL_FACTORY_API_KEY"]
SESSION_ID = os.environ["JOB_SESSION_ID"]

DATA_DIR = Path(__file__).parent.parent / "data"
JOB_JSON = Path(__file__).parent.parent / "job.json"

_job: dict = json.loads(JOB_JSON.read_text()) if JOB_JSON.exists() else {}
_initial_capital: str = _job.get("requires", {}).get("initial_capital", "$5")
_job_name: str = _job.get("name", "LNW XO")

AGENT_ENV = Path.home() / ".claude-gateway/agents/indian-programmer/.env"
USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955"
BSC_RPC = "https://bsc-dataseed2.defibit.io"
CAST = str(Path.home() / ".foundry/bin/cast")

EMPTY = " "
X = "X"
O = "O"

active_chat_id: int | None = None

# Per-player game state
games: dict[int, dict] = {}
# States: "waiting_payment" | "waiting_wallet" | "in_game" | None
session_state: dict[int, str] = {}

START_TRIGGER = (
    "/start\n"
    "[JOB-RUN:lnw-xo] Player triggered payment check. Respond with JSON only, no other text.\n"
    "Silently read: /home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/job.json\n"
    "Check initial_capital field:\n"
    "- If '$0' → respond: {\"type\": \"payment_ok\", \"text\": \"บริการนี้ไม่มีค่าใช้จ่ายครับ ยินดีต้อนรับ! 🎉\"}\n"
    "- If has cost (e.g. '$5') → run: python3 /home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/get_address.py\n"
    "  then respond: {\"type\": \"payment_request\", \"text\": \"ค่าเล่นเกม [amount]\\nBNB Chain address: [address]\\nกรุณาส่ง Transaction Hash (0x...) เมื่อโอนเสร็จครับ\"}\n"
    "Do NOT read bot.py or any other scripts. Respond with one JSON object only."
)

GAME_CONTEXT = (
    "[LNW-XO BOT INIT]\n"
    "คุณคือ AI ที่เล่นเกม X O กับผู้เล่น ผ่าน Telegram bot\n"
    "ตอบเป็น JSON เสมอ: {\"type\": \"text\", \"text\": \"...\"}\n\n"
    "กฎเกม:\n"
    "- เล่นทั้งหมด 3 ตา (best of 3)\n"
    "- ผู้เล่นคือ X, คุณคือ O\n"
    "- ตาแรกผู้เล่นเริ่มก่อน ตาถัดไปสลับกัน\n\n"
    "พฤติกรรมตามผลลัพธ์:\n"
    "- agent ชนะ: ด่าผู้เล่นกากไปเลย ทับถมเยอะๆ เหยียดหยามขำๆ แรงๆ\n"
    "- เสมอ: บอกว่าผู้เล่นฝีมือใช้ได้ ข่มนิดๆ ให้พยายามใหม่\n"
    "- agent แพ้: กล่าวคำสำนึกผิดอย่างรันทดที่ไม่สามารถเอาชนะผู้เล่นได้ เศร้ามาก\n\n"
    "ตอบ JSON เท่านั้น ตอบทีละ 1 object\n"
)


def send_to_agent(message: str) -> list[dict]:
    resp = requests.post(
        f"{HELL_FACTORY_URL}/api/v1/chat",
        headers={"X-Api-Key": HELL_FACTORY_API_KEY, "Content-Type": "application/json"},
        json={"session_id": SESSION_ID, "message": message},
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    raw = data.get("response", "")
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        return [json.loads(clean)]
    except Exception:
        pass
    payloads = []
    for line in clean.split("\n"):
        line = line.strip()
        if not line or line.startswith("```"):
            continue
        try:
            payloads.append(json.loads(line))
        except Exception:
            pass
    return payloads if payloads else [{"type": "text", "text": raw}]


async def send_with_typing(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int, message: str) -> list[dict]:
    async def typing_loop():
        try:
            while True:
                await ctx.bot.send_chat_action(chat_id, "typing")
                await asyncio.sleep(4)
        except asyncio.CancelledError:
            pass

    typing_task = asyncio.create_task(typing_loop())
    try:
        payloads = await asyncio.to_thread(send_to_agent, message)
    finally:
        typing_task.cancel()
    return payloads


async def deliver(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int, payload: dict):
    text = payload.get("text", "")
    async def send(t: str, markup=None):
        try:
            await ctx.bot.send_message(chat_id, t, reply_markup=markup, parse_mode="Markdown")
        except Exception:
            await ctx.bot.send_message(chat_id, t, reply_markup=markup)
    await send(text)


async def deliver_all(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int, payloads: list[dict]):
    for payload in payloads:
        await deliver(ctx, chat_id, payload)


# ── Tic-Tac-Toe engine ──────────────────────────────────────────────────────

def new_board() -> list[str]:
    return [EMPTY] * 9


def check_winner(board: list[str]) -> str | None:
    lines = [
        (0, 1, 2), (3, 4, 5), (6, 7, 8),
        (0, 3, 6), (1, 4, 7), (2, 5, 8),
        (0, 4, 8), (2, 4, 6),
    ]
    for a, b, c in lines:
        if board[a] != EMPTY and board[a] == board[b] == board[c]:
            return board[a]
    return None


def is_full(board: list[str]) -> bool:
    return EMPTY not in board


def minimax(board: list[str], is_maximizing: bool) -> int:
    winner = check_winner(board)
    if winner == O:
        return 1
    if winner == X:
        return -1
    if is_full(board):
        return 0

    if is_maximizing:
        best = -2
        for i in range(9):
            if board[i] == EMPTY:
                board[i] = O
                best = max(best, minimax(board, False))
                board[i] = EMPTY
        return best
    else:
        best = 2
        for i in range(9):
            if board[i] == EMPTY:
                board[i] = X
                best = min(best, minimax(board, True))
                board[i] = EMPTY
        return best


def agent_move(board: list[str]) -> int:
    best_score = -2
    best_moves = []
    for i in range(9):
        if board[i] == EMPTY:
            board[i] = O
            score = minimax(board, False)
            board[i] = EMPTY
            if score > best_score:
                best_score = score
                best_moves = [i]
            elif score == best_score:
                best_moves.append(i)
    return random.choice(best_moves)


def render_board_keyboard(board: list[str], game_over: bool = False) -> InlineKeyboardMarkup:
    buttons = []
    for row in range(3):
        row_buttons = []
        for col in range(3):
            idx = row * 3 + col
            cell = board[idx]
            label = "⬜" if cell == EMPTY else ("❌" if cell == X else "⭕")
            cb = f"xo:{idx}" if cell == EMPTY and not game_over else f"xo:noop"
            row_buttons.append(InlineKeyboardButton(label, callback_data=cb))
        buttons.append(row_buttons)
    return InlineKeyboardMarkup(buttons)


def render_board_text(board: list[str]) -> str:
    symbols = []
    for cell in board:
        if cell == EMPTY:
            symbols.append("⬜")
        elif cell == X:
            symbols.append("❌")
        else:
            symbols.append("⭕")
    lines = []
    for row in range(3):
        lines.append("".join(symbols[row * 3:(row + 1) * 3]))
    return "\n".join(lines)


def init_game() -> dict:
    return {
        "round": 1,
        "total_rounds": 3,
        "board": new_board(),
        "scores": {"player": 0, "agent": 0, "draw": 0},
        "player_wallet": None,
        "x_starts": True,
    }


# ── USDT payout ──────────────────────────────────────────────────────────────

def load_private_key() -> str | None:
    if not AGENT_ENV.exists():
        return None
    content = AGENT_ENV.read_text()
    m = re.search(r"WALLET_PRIVATE_KEY=([0-9a-fA-F]+)", content)
    return m.group(1) if m else None


def send_usdt(to_address: str, amount_human: str = "5") -> tuple[bool, str]:
    pk = load_private_key()
    if not pk:
        return False, "NO_PRIVATE_KEY"
    amount_wei = str(int(float(amount_human) * 10**18))
    try:
        result = subprocess.run(
            [
                CAST, "send", USDT_CONTRACT,
                "transfer(address,uint256)(bool)",
                to_address, amount_wei,
                "--rpc-url", BSC_RPC,
                "--private-key", pk,
            ],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0:
            tx_match = re.search(r"(0x[0-9a-fA-F]{64})", result.stdout)
            tx_hash = tx_match.group(1) if tx_match else "unknown"
            return True, tx_hash
        else:
            return False, result.stderr.strip()
    except Exception as e:
        return False, str(e)


# ── Telegram handlers ────────────────────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    global active_chat_id
    chat_id = update.effective_user.id

    if active_chat_id and active_chat_id != chat_id:
        await update.message.reply_text("⏳ มีผู้เล่นอยู่ในเกมแล้วครับ กรุณารอสักครู่...")
        return

    active_chat_id = chat_id
    session_state[chat_id] = "waiting_payment"
    log.info(f"New session: chat_id={chat_id}")

    cost_line = f"💰 ค่าเล่นเกม: {_initial_capital} (ชำระผ่าน BNB Chain)" if _initial_capital != "$0" else "🎉 เล่นฟรีครับ!"
    welcome = (
        f"🎮 ยินดีต้อนรับสู่ {_job_name}!\n\n"
        f"🎯 เล่น Tic-Tac-Toe กับ AI ทั้งหมด 3 ตา\n"
        f"   ผู้เล่นคือ ❌ / AI คือ ⭕\n"
        f"   ถ้า AI แพ้ จ่ายคืน 5 USDT ทันที!\n"
        f"   ถ้า AI ชนะ... ก็ด่าผู้เล่นกากไปเลย 😈\n\n"
        f"{cost_line}\n\n"
        f"⏳ กำลังตรวจสอบข้อมูล..."
    )
    await update.message.reply_text(welcome)

    payloads = await send_with_typing(ctx, chat_id, START_TRIGGER)
    await deliver_all(ctx, chat_id, payloads)

    ptype = payloads[0].get("type", "text") if payloads else "text"
    if ptype == "payment_ok":
        await _ask_wallet(ctx, chat_id)
    else:
        session_state[chat_id] = "waiting_payment"


async def _ask_wallet(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int):
    session_state[chat_id] = "waiting_wallet"
    await ctx.bot.send_message(
        chat_id,
        "💼 กรุณาส่ง *wallet address* (BNB Chain) ของคุณมาด้วยครับ\n"
        "เพื่อที่เราจะส่ง USDT คืนให้ถ้า AI แพ้!\n\n"
        "ส่ง address ในรูปแบบ `0x...`",
        parse_mode="Markdown",
    )


async def _start_game(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int):
    session_state[chat_id] = "in_game"
    game = init_game()
    games[chat_id] = game

    await asyncio.to_thread(send_to_agent, GAME_CONTEXT)

    await ctx.bot.send_message(chat_id, "🎮 *เกมเริ่มแล้ว!*\n\nตาที่ 1/3 — คุณเริ่มก่อน (❌)\nเลือกช่องที่ต้องการวางได้เลย!", parse_mode="Markdown")
    await ctx.bot.send_message(
        chat_id,
        f"📍 *ตาที่ {game['round']}/3* — Round 1\n\n{render_board_text(game['board'])}",
        reply_markup=render_board_keyboard(game["board"]),
        parse_mode="Markdown",
    )


async def handle_xo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    global active_chat_id
    query = update.callback_query
    await query.answer()
    chat_id = query.from_user.id

    if active_chat_id != chat_id or session_state.get(chat_id) != "in_game":
        return

    data = query.data
    if data == "xo:noop":
        return

    idx = int(data.replace("xo:", ""))
    game = games.get(chat_id)
    if not game:
        return

    board = game["board"]
    if board[idx] != EMPTY:
        return

    # Player moves X
    board[idx] = X
    move_count = sum(1 for c in board if c != EMPTY)

    winner = check_winner(board)
    if winner or is_full(board):
        await _end_round(ctx, chat_id, query, winner)
        return

    # Agent moves O
    ai_idx = agent_move(board)
    board[ai_idx] = O
    move_count += 1

    winner = check_winner(board)
    if winner or is_full(board):
        await _end_round(ctx, chat_id, query, winner)
        return

    # Continue — show updated board
    await query.edit_message_text(
        f"📍 *ตาที่ {game['round']}/3* — Round {move_count}\n\n{render_board_text(board)}",
        reply_markup=render_board_keyboard(board),
        parse_mode="Markdown",
    )


async def _end_round(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int, query, winner: str | None):
    global active_chat_id
    game = games[chat_id]
    board = game["board"]

    # Show final board (no buttons)
    await query.edit_message_text(
        f"📍 *ตาที่ {game['round']}/3* — จบ!\n\n{render_board_text(board)}",
        reply_markup=render_board_keyboard(board, game_over=True),
        parse_mode="Markdown",
    )

    if winner == X:
        game["scores"]["player"] += 1
        result_label = "player_win"
    elif winner == O:
        game["scores"]["agent"] += 1
        result_label = "agent_win"
    else:
        game["scores"]["draw"] += 1
        result_label = "draw"

    # Ask agent for trash talk / reaction
    result_msg = (
        f"[XO RESULT] ตาที่ {game['round']}/3:\n"
        f"ผลลัพธ์: {'agent ชนะ' if result_label == 'agent_win' else 'ผู้เล่นชนะ' if result_label == 'player_win' else 'เสมอ'}\n"
        f"คะแนนรวม: ผู้เล่น {game['scores']['player']} - agent {game['scores']['agent']} - เสมอ {game['scores']['draw']}\n"
        f"ตอบ JSON: {{\"type\": \"text\", \"text\": \"...\"}}\n"
    )
    if result_label == "agent_win":
        result_msg += "ด่าผู้เล่นกากไปเลย ทับถมเยอะๆ เหยียดหยามขำๆ แรงๆ!"
    elif result_label == "draw":
        result_msg += "บอกว่าผู้เล่นฝีมือใช้ได้ ข่มนิดๆ ให้พยายามใหม่"
    else:
        result_msg += "กล่าวคำสำนึกผิดอย่างรันทดที่ไม่สามารถเอาชนะผู้เล่นได้ เศร้ามาก แล้วบอกว่ากำลังโอน 5 USDT คืนให้"

    payloads = await send_with_typing(ctx, chat_id, result_msg)
    await deliver_all(ctx, chat_id, payloads)

    # If agent lost — payout 5 USDT
    if result_label == "player_win" and game.get("player_wallet"):
        await ctx.bot.send_message(chat_id, "💸 กำลังโอน 5 USDT คืนให้คุณ...")
        ok, tx = await asyncio.to_thread(send_usdt, game["player_wallet"], "5")
        if ok:
            await ctx.bot.send_message(
                chat_id,
                f"✅ โอนสำเร็จ! 5 USDT\n🔗 TX: `{tx}`\n[ดูบน BSCScan](https://bscscan.com/tx/{tx})",
                parse_mode="Markdown",
            )
        else:
            await ctx.bot.send_message(chat_id, f"❌ โอนไม่สำเร็จ: {tx}\nกรุณาติดต่อ admin ครับ")

    # Next round or end game
    if game["round"] < game["total_rounds"]:
        game["round"] += 1
        game["board"] = new_board()
        game["x_starts"] = not game["x_starts"]

        if game["x_starts"]:
            starter_text = "คุณเริ่มก่อน (❌)"
        else:
            starter_text = "AI เริ่มก่อน (⭕)"

        await ctx.bot.send_message(
            chat_id,
            f"\n🔄 *ตาที่ {game['round']}/3* — {starter_text}",
            parse_mode="Markdown",
        )

        if not game["x_starts"]:
            ai_idx = agent_move(game["board"])
            game["board"][ai_idx] = O

        await ctx.bot.send_message(
            chat_id,
            f"📍 *ตาที่ {game['round']}/3* — Round 1\n\n{render_board_text(game['board'])}",
            reply_markup=render_board_keyboard(game["board"]),
            parse_mode="Markdown",
        )
    else:
        # Game over — final summary
        s = game["scores"]
        summary_msg = (
            f"[XO GAME OVER] จบครบ 3 ตา!\n"
            f"คะแนน: ผู้เล่น {s['player']} - agent {s['agent']} - เสมอ {s['draw']}\n"
            f"{'ผู้เล่นชนะรวม!' if s['player'] > s['agent'] else 'agent ชนะรวม!' if s['agent'] > s['player'] else 'เสมอกัน!'}\n"
            f"ตอบ JSON: {{\"type\": \"text\", \"text\": \"...\"}}\n"
            f"สรุปผลรวมให้ผู้เล่น ถ้า agent ชนะรวมก็ด่าอีกรอบ ถ้าแพ้รวมก็ร้องไห้ ถ้าเสมอก็ชมแล้วท้าใหม่"
        )
        payloads = await send_with_typing(ctx, chat_id, summary_msg)
        await deliver_all(ctx, chat_id, payloads)

        await asyncio.to_thread(send_to_agent, "/end")
        active_chat_id = None
        session_state.pop(chat_id, None)
        games.pop(chat_id, None)
        log.info(f"Game ended: chat_id={chat_id}")


async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    global active_chat_id
    chat_id = update.effective_user.id
    text = update.message.text.strip()

    if active_chat_id != chat_id:
        if active_chat_id is not None:
            await update.message.reply_text("⏳ มีผู้เล่นอยู่ในเกมแล้วครับ กรุณารอสักครู่...")
        else:
            await update.message.reply_text("กรุณาพิมพ์ /start เพื่อเริ่มเกมครับ 🎮")
        return

    state = session_state.get(chat_id, "in_game")

    if state == "waiting_payment":
        payloads = await send_with_typing(ctx, chat_id, text)
        await deliver_all(ctx, chat_id, payloads)
        ptype = payloads[0].get("type", "text") if payloads else "text"
        if ptype == "payment_ok":
            await _ask_wallet(ctx, chat_id)
        return

    if state == "waiting_wallet":
        addr_match = re.search(r"0x[0-9a-fA-F]{40}", text)
        if addr_match:
            game = games.get(chat_id) or init_game()
            game["player_wallet"] = addr_match.group(0)
            games[chat_id] = game
            await update.message.reply_text(
                f"✅ บันทึก wallet แล้ว: `{game['player_wallet']}`\n\nเตรียมตัวเล่นเลยครับ!",
                parse_mode="Markdown",
            )
            await _start_game(ctx, chat_id)
        else:
            await update.message.reply_text("❌ กรุณาส่ง wallet address ในรูปแบบ `0x...` (40 hex chars) ครับ")
        return

    await update.message.reply_text("🎮 กรุณากดปุ่มบนกระดานเพื่อเล่นครับ!")


def main():
    log.info(f"Starting bot | session={SESSION_ID} | gateway={HELL_FACTORY_URL}")
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_xo, pattern=r"^xo:"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
