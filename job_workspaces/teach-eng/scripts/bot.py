#!/usr/bin/env python3
"""teach-eng Telegram Bot — pay crypto → learn English."""

import asyncio
import json
import logging
import os
import random
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / "config" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true" or "--dry-run" in sys.argv
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
WALLET_ADDRESS = os.getenv("WALLET_ADDRESS", "0xf0189A9b34239DC69B9294Fe681115d342962295").lower()
LESSON_PRICE_USDT = float(os.getenv("LESSON_PRICE_USDT", "1.0"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))
from main import ACTIVITY_TEMPLATES

# ── Conversation states ──────────────────────────────────────────────────────
PAYING, CHOOSE_AGE, CHOOSE_LEVEL, CHOOSE_TOPIC, IN_LESSON = range(5)

# ── Chain RPC endpoints (public, no API key needed) ──────────────────────────
CHAINS = {
    "ETH":     "https://cloudflare-eth.com",
    "BSC":     "https://bsc-dataseed1.binance.org",
    "Polygon": "https://polygon-rpc.com",
}

# ERC-20 USDT contract addresses per chain
USDT_CONTRACTS = {
    "ETH":     "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "BSC":     "0x55d398326f99059ff775485246999027b3197955",
    "Polygon": "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
}

# ERC-20 transfer(address,uint256) selector
ERC20_TRANSFER_SELECTOR = "0xa9059cbb"

# Already-used tx hashes (prevent replay)
used_tx_hashes: set[str] = set()

# ── Vocab / activity data ────────────────────────────────────────────────────
VOCAB_BANKS = {
    "animals":  [("dog","🐶"),("cat","🐱"),("fish","🐟"),("bird","🐦"),("rabbit","🐰"),
                 ("lion","🦁"),("elephant","🐘"),("monkey","🐵"),("frog","🐸"),("horse","🐴")],
    "food":     [("apple","🍎"),("banana","🍌"),("pizza","🍕"),("rice","🍚"),("egg","🥚"),
                 ("milk","🥛"),("bread","🍞"),("cake","🎂"),("soup","🍲"),("noodle","🍜")],
    "colors":   [("red","🔴"),("blue","🔵"),("green","🟢"),("yellow","🟡"),("pink","🩷"),
                 ("orange","🟠"),("purple","🟣"),("white","⬜"),("black","⬛"),("brown","🟤")],
    "numbers":  [("one","1️⃣"),("two","2️⃣"),("three","3️⃣"),("four","4️⃣"),("five","5️⃣"),
                 ("six","6️⃣"),("seven","7️⃣"),("eight","8️⃣"),("nine","9️⃣"),("ten","🔟")],
    "body":     [("head","👤"),("hand","🤚"),("eye","👁"),("mouth","👄"),("ear","👂"),
                 ("nose","👃"),("leg","🦵"),("arm","💪"),("back","🫀"),("foot","🦶")],
    "default":  [("happy","😊"),("sad","😢"),("big","🔺"),("small","🔻"),("fast","⚡"),
                 ("slow","🐌"),("hot","🔥"),("cold","❄️"),("new","✨"),("old","📜")],
}

ENCOURAGEMENTS = ["Great job! 🌟", "Excellent! 🎉", "Well done! 👏", "Perfect! ✅", "Amazing! 🚀", "Super! ⭐"]
WRONG_REPLIES  = ["Not quite!", "Oops!", "Almost!", "Good try!"]

sessions: dict[int, dict] = {}


# ── Blockchain verification ──────────────────────────────────────────────────

async def _rpc_call(url: str, method: str, params: list) -> dict | None:
    try:
        import urllib.request
        payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logger.debug("RPC %s failed: %s", url, e)
        return None


def _parse_usdt_transfer(input_data: str, to_wallet: str) -> float:
    """Return USDT amount if input is a transfer() to to_wallet, else 0."""
    data = input_data.lower().replace("0x", "")
    if not input_data.lower().startswith(ERC20_TRANSFER_SELECTOR):
        return 0.0
    # transfer(address recipient, uint256 amount)
    # recipient is bytes 4-35 (padded 32 bytes), last 20 bytes = address
    if len(data) < 136:
        return 0.0
    recipient = "0x" + data[32:72]  # last 20 bytes of first 32-byte slot (offset 4 bytes selector)
    # correct offset: selector(4 bytes) + recipient(32 bytes) + amount(32 bytes)
    recipient_hex = data[8:72]  # 32 bytes after selector
    recipient_addr = "0x" + recipient_hex[-40:]
    if recipient_addr != to_wallet.lower():
        return 0.0
    amount_hex = data[72:136]
    raw_amount = int(amount_hex, 16)
    return raw_amount / 1e6  # USDT has 6 decimals


async def verify_tx(tx_hash: str) -> tuple[bool, str]:
    """
    Check tx_hash on ETH/BSC/Polygon.
    Returns (ok, message).
    Accepts: native coin transfer to WALLET_ADDRESS (any amount > 0)
             OR ERC-20 USDT transfer to WALLET_ADDRESS >= LESSON_PRICE_USDT
    """
    tx_hash = tx_hash.strip().lower()
    if not tx_hash.startswith("0x") or len(tx_hash) != 66:
        return False, "Invalid tx hash format. Must be 0x + 64 hex characters."

    if tx_hash in used_tx_hashes:
        return False, "This transaction has already been used."

    for chain, rpc_url in CHAINS.items():
        result = await _rpc_call(rpc_url, "eth_getTransactionByHash", [tx_hash])
        if not result or "result" not in result or not result["result"]:
            continue
        tx = result["result"]

        # Check tx is confirmed (has block)
        if not tx.get("blockNumber"):
            return False, f"Transaction found on {chain} but not yet confirmed. Please wait a moment and try again."

        to_addr = (tx.get("to") or "").lower()
        value = int(tx.get("value", "0x0"), 16)

        # Native coin transfer directly to our wallet
        if to_addr == WALLET_ADDRESS and value > 0:
            used_tx_hashes.add(tx_hash)
            coin = {"ETH": "ETH", "BSC": "BNB", "Polygon": "MATIC"}[chain]
            amount = value / 1e18
            return True, f"✅ Payment confirmed on {chain}! Received {amount:.6f} {coin}"

        # ERC-20 USDT transfer
        usdt_contract = USDT_CONTRACTS.get(chain, "")
        if to_addr == usdt_contract:
            usdt_amount = _parse_usdt_transfer(tx.get("input", ""), WALLET_ADDRESS)
            if usdt_amount >= LESSON_PRICE_USDT:
                used_tx_hashes.add(tx_hash)
                return True, f"✅ Payment confirmed on {chain}! Received {usdt_amount:.2f} USDT"
            elif usdt_amount > 0:
                return False, f"Payment too low: {usdt_amount:.2f} USDT received, {LESSON_PRICE_USDT} USDT required."

    return False, "Transaction not found or not valid. Make sure:\n• Correct tx hash\n• Sent to the right wallet\n• Network: ETH / BSC / Polygon"


# ── Lesson helpers ───────────────────────────────────────────────────────────

def get_vocab(topic: str, count: int = 6) -> list:
    bank = VOCAB_BANKS.get(topic.lower(), VOCAB_BANKS["default"])
    return random.sample(bank, min(count, len(bank)))


def _make_choices(correct: str, vocab: list) -> list[str]:
    others = [w for w, _ in vocab if w != correct]
    wrongs = random.sample(others, min(3, len(others)))
    choices = [correct] + wrongs
    random.shuffle(choices)
    return choices


def build_lesson_questions(age: str, level: str, topic: str) -> list[dict]:
    vocab = get_vocab(topic)
    questions = []
    for word, emoji in vocab[:3]:
        questions.append({"type": "qa",    "prompt": f"What is this? {emoji}", "answer": word, "choices": _make_choices(word, vocab)})
    for word, emoji in vocab[3:6]:
        questions.append({"type": "match", "prompt": f"Match the emoji:\n{emoji}", "answer": word, "choices": _make_choices(word, vocab)})
    if age == "adults" or level in ("intermediate", "advanced"):
        templates = ACTIVITY_TEMPLATES.get("fillblank", {}).get(age, [])
        for t in random.sample(templates, min(2, len(templates))):
            questions.append({"type": "info", "prompt": f"📝 Practice:\n{t}", "answer": None})
    return questions


def format_question(q: dict, idx: int, total: int) -> tuple[str, list | None]:
    header = f"Question {idx}/{total}\n\n"
    if q["type"] in ("qa", "match"):
        return header + q["prompt"], q["choices"]
    return header + q["prompt"], None


def check_answer(session: dict, user_answer: str) -> tuple[bool, str]:
    q = session["questions"][session["current"]]
    if q["answer"] is None:
        return True, random.choice(ENCOURAGEMENTS)
    if user_answer.lower().strip() == q["answer"].lower():
        return True, random.choice(ENCOURAGEMENTS)
    return False, f"{random.choice(WRONG_REPLIES)} The answer is *{q['answer']}*"


# ── Telegram bot setup ───────────────────────────────────────────────────────

def _setup_bot(token: str):
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import (
        Application, CommandHandler, MessageHandler,
        CallbackQueryHandler, ConversationHandler, filters, ContextTypes,
    )

    WALLET_DISPLAY = os.getenv("WALLET_ADDRESS", "0xf0189A9b34239DC69B9294Fe681115d342962295")

    def payment_prompt() -> str:
        return (
            f"👋 Welcome! To start a lesson, please pay first.\n\n"
            f"💰 Price: *{LESSON_PRICE_USDT} USDT* (or any ETH/BNB/MATIC)\n\n"
            f"📬 Send to:\n`{WALLET_DISPLAY}`\n\n"
            f"Supported networks: ETH • BSC • Polygon\n\n"
            f"After paying, send me your *transaction hash* (0x...)\n\n"
            f"_Type /cancel to exit_"
        )

    async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        sessions.pop(chat_id, None)
        await update.message.reply_text(payment_prompt(), parse_mode="Markdown")
        return PAYING

    async def handle_payment(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        tx_hash = update.message.text.strip()
        msg = await update.message.reply_text("🔍 Verifying payment on-chain...")
        ok, feedback = await verify_tx(tx_hash)
        if ok:
            await msg.edit_text(f"{feedback}\n\n🎓 Payment verified! Let's start!")
            sessions[chat_id] = {}
            keyboard = [[InlineKeyboardButton("👧 Kids (5–12)", callback_data="age:kids"),
                         InlineKeyboardButton("🧑 Adults", callback_data="age:adults")]]
            await update.message.reply_text("Who am I teaching today?", reply_markup=InlineKeyboardMarkup(keyboard))
            return CHOOSE_AGE
        else:
            await msg.edit_text(f"❌ {feedback}\n\nPlease send the correct tx hash, or try again.")
            return PAYING

    async def choose_age(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        sessions[query.message.chat_id]["age"] = query.data.split(":")[1]
        keyboard = [
            [InlineKeyboardButton("🌱 Beginner",     callback_data="level:beginner")],
            [InlineKeyboardButton("🌿 Intermediate", callback_data="level:intermediate")],
            [InlineKeyboardButton("🌳 Advanced",     callback_data="level:advanced")],
        ]
        await query.edit_message_text("What level?", reply_markup=InlineKeyboardMarkup(keyboard))
        return CHOOSE_LEVEL

    async def choose_level(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        sessions[query.message.chat_id]["level"] = query.data.split(":")[1]
        topics = [t for t in VOCAB_BANKS if t != "default"]
        keyboard = [[InlineKeyboardButton(t.title(), callback_data=f"topic:{t}")] for t in topics]
        await query.edit_message_text("Choose a topic:", reply_markup=InlineKeyboardMarkup(keyboard))
        return CHOOSE_TOPIC

    async def choose_topic(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        chat_id = query.message.chat_id
        s = sessions[chat_id]
        s["topic"] = query.data.split(":")[1]
        s["questions"] = build_lesson_questions(s["age"], s["level"], s["topic"])
        s["current"] = 0
        s["score"] = 0
        await query.edit_message_text(
            f"📚 Topic: *{s['topic'].title()}* | {len(s['questions'])} questions\n\nType /stop to end.",
            parse_mode="Markdown",
        )
        await _send_question(chat_id, ctx)
        return IN_LESSON

    async def _send_question(chat_id: int, ctx: ContextTypes.DEFAULT_TYPE):
        s = sessions[chat_id]
        idx = s["current"]
        total = len(s["questions"])
        if idx >= total:
            pct = int(s["score"] / total * 100)
            await ctx.bot.send_message(
                chat_id,
                f"🎊 Lesson complete!\n\nScore: {s['score']}/{total} ({pct}%)\n"
                + ("⭐⭐⭐ Outstanding!" if pct >= 80 else "👍 Keep practicing!"),
            )
            sessions.pop(chat_id, None)
            return
        text, choices = format_question(s["questions"][idx], idx + 1, total)
        if choices:
            keyboard = [[InlineKeyboardButton(c, callback_data=f"ans:{c}")] for c in choices]
            await ctx.bot.send_message(chat_id, text, reply_markup=InlineKeyboardMarkup(keyboard))
        else:
            await ctx.bot.send_message(chat_id, text)

    async def handle_answer_button(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        chat_id = query.message.chat_id
        if chat_id not in sessions:
            await query.edit_message_text("Session expired. Type /start to begin.")
            return IN_LESSON
        s = sessions[chat_id]
        ok, fb = check_answer(s, query.data.split(":", 1)[1])
        if ok:
            s["score"] += 1
        await ctx.bot.send_message(chat_id, fb, parse_mode="Markdown")
        s["current"] += 1
        await _send_question(chat_id, ctx)
        return IN_LESSON

    async def handle_text_answer(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        if chat_id not in sessions:
            await update.message.reply_text("Type /start to begin!")
            return IN_LESSON
        s = sessions[chat_id]
        ok, fb = check_answer(s, update.message.text)
        if ok:
            s["score"] += 1
        await update.message.reply_text(fb, parse_mode="Markdown")
        s["current"] += 1
        await _send_question(chat_id, ctx)
        return IN_LESSON

    async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        sessions.pop(update.effective_chat.id, None)
        await update.message.reply_text("Cancelled. Type /start to begin a new lesson. 👋")
        return ConversationHandler.END

    app = Application.builder().token(token).build()
    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            PAYING:      [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_payment)],
            CHOOSE_AGE:  [CallbackQueryHandler(choose_age,  pattern="^age:")],
            CHOOSE_LEVEL:[CallbackQueryHandler(choose_level, pattern="^level:")],
            CHOOSE_TOPIC:[CallbackQueryHandler(choose_topic, pattern="^topic:")],
            IN_LESSON:   [
                CallbackQueryHandler(handle_answer_button, pattern="^ans:"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_answer),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel), CommandHandler("stop", cancel)],
        allow_reentry=True,
    )
    app.add_handler(conv)
    return app


# ── Dry-run simulation ───────────────────────────────────────────────────────

async def dry_run_simulation():
    print("=== DRY RUN: teach-eng Bot (Crypto Payment + Lesson) ===\n")
    WALLET_DISPLAY = os.getenv("WALLET_ADDRESS", "0xf0189A9b34239DC69B9294Fe681115d342962295")

    print("── Step 1: Payment prompt ──────────────────────────────")
    print(f"Bot: Welcome! Pay {LESSON_PRICE_USDT} USDT to:")
    print(f"     {WALLET_DISPLAY}")
    print("     Supported: ETH / BSC / Polygon\n")

    print("── Step 2: TX verification (simulated) ─────────────────")
    fake_tx = "0x" + "ab" * 32
    print(f"User: {fake_tx}")
    print("Bot:  🔍 Verifying on-chain...")
    # Simulate verification result (skip real network call in dry-run)
    print("Bot:  ✅ [DRY-RUN] Payment verified! 1.00 USDT on Polygon\n")

    print("── Step 3: Lesson flow ─────────────────────────────────")
    age, level, topic = "kids", "beginner", "animals"
    questions = build_lesson_questions(age, level, topic)
    print(f"Session: {age}/{level}/{topic} — {len(questions)} questions\n")

    score = 0
    for i, q in enumerate(questions):
        text, choices = format_question(q, i + 1, len(questions))
        print(f"{text}")
        if choices:
            for j, c in enumerate(choices):
                print(f"  [{j+1}] {c}")
            correct_ans = q["answer"]
            print(f"> [simulated]: {correct_ans}")
            ok, fb = check_answer({"questions": questions, "current": i}, correct_ans)
            print(f"Bot: {fb}\n")
            if ok:
                score += 1
        else:
            print("  [info — no answer]\n")

    pct = int(score / len(questions) * 100) if questions else 0
    print(f"🎊 Lesson complete! Score: {score}/{len(questions)} ({pct}%)")
    print("\n[DRY RUN] All OK — no Telegram API calls, no real tx checked.")


def main():
    if DRY_RUN or not BOT_TOKEN:
        if not DRY_RUN and not BOT_TOKEN:
            print("[WARN] TELEGRAM_BOT_TOKEN not set — running dry-run\n")
        asyncio.run(dry_run_simulation())
        return

    try:
        from telegram.ext import Application  # noqa: F401
    except ImportError:
        print("[ERROR] python-telegram-bot not installed. Run: bash scripts/setup.sh")
        sys.exit(1)

    app = _setup_bot(BOT_TOKEN)
    logger.info("teach-eng bot starting (payment: %s USDT → %s)", LESSON_PRICE_USDT, WALLET_ADDRESS)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
