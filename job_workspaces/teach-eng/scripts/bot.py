#!/usr/bin/env python3
"""English teaching Telegram bot — routes messages through Hell-Factory Chat API."""

import asyncio
import os
import json
import logging
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

# Load job info once at startup
_job: dict = json.loads(JOB_JSON.read_text()) if JOB_JSON.exists() else {}
_initial_capital: str = _job.get("requires", {}).get("initial_capital", "$0")
_job_name: str = _job.get("name", "English Teaching")
_job_desc: str = _job.get("description", "")

# One active student at a time
active_chat_id: int | None = None

# States: "waiting_payment" | "in_lesson" | None
session_state: dict[int, str] = {}

START_TRIGGER = (
    "/start\n"
    "[JOB-RUN:teach-eng] Student triggered payment check. Respond with JSON only, no other text.\n"
    "Silently read: /home/dev/projects/hell-factory-company/job_workspaces/teach-eng/job.json\n"
    "Check initial_capital field:\n"
    "- If '$0' → respond: {\"type\": \"payment_ok\", \"text\": \"บริการนี้ไม่มีค่าใช้จ่ายครับ ยินดีต้อนรับ! 🎉\"}\n"
    "- If has cost (e.g. '$5') → run: python3 /home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/get_address.py\n"
    "  then respond: {\"type\": \"payment_request\", \"text\": \"ค่าบริการ [amount]\\nBNB Chain address: [address]\\nกรุณาส่ง Transaction Hash (0x...) เมื่อโอนเสร็จครับ\"}\n"
    "Do NOT read bot.py or any other scripts. Respond with one JSON object only."
)

TEACHER_CONTEXT = (
    "[TEACH-ENG BOT INIT]\n"
    "คุณคือครูสอนภาษาอังกฤษผ่าน Telegram ชื่อ @eng_by_indian_programmer_bot\n"
    "นักเรียนคนหนึ่งเพิ่งชำระเงินและพร้อมเรียนแล้ว กรุณาตอบเป็น JSON เสมอในรูปแบบต่อไปนี้:\n\n"
    "ข้อความทั่วไป: {\"type\": \"text\", \"text\": \"...\"}\n"
    "โจทย์คำศัพท์: {\"type\": \"question\", \"text\": \"...\", \"choices\": [\"A\", \"B\", \"C\", \"D\"]}\n"
    "จบ session: {\"type\": \"summary\", \"text\": \"...\"}\n\n"
    "กฎ:\n"
    "- สอนคำศัพท์ 10 คำต่อ session\n"
    "- แต่ละข้อมี 4 ตัวเลือก (1 ถูก + 3 ผิด)\n"
    "- เฉลยทุกครั้งหลังนักเรียนตอบ\n"
    "- สรุปคะแนนเมื่อครบ 10 ข้อ\n\n"
    "ตอบเป็น JSON เท่านั้น ห้ามรวมหลาย JSON ในข้อความเดียว ตอบทีละ 1 JSON object เท่านั้น\n\n"
    "ทักทายนักเรียนสั้นๆ แล้วส่งโจทย์ข้อที่ 1 เป็น JSON ได้เลยครับ"
)


def send_to_agent(message: str) -> list[dict]:
    """Send message to Hell-Factory chat API, return list of parsed JSON payloads."""
    resp = requests.post(
        f"{HELL_FACTORY_URL}/api/v1/chat",
        headers={"X-Api-Key": HELL_FACTORY_API_KEY, "Content-Type": "application/json"},
        json={"session_id": SESSION_ID, "message": message},
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    raw = data.get("response", "")

    # Strip code block wrapper if present
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    # Try single JSON first
    try:
        return [json.loads(clean)]
    except Exception:
        pass

    # Try line-by-line (agent returned multiple JSON objects)
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
    """Send message to agent with typing indicator while waiting."""
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
    """Send a single agent payload to Telegram student."""
    text = payload.get("text", "")
    choices = payload.get("choices", [])

    async def send(t: str, markup=None):
        try:
            await ctx.bot.send_message(chat_id, t, reply_markup=markup, parse_mode="Markdown")
        except Exception:
            await ctx.bot.send_message(chat_id, t, reply_markup=markup)

    if choices:
        buttons = [[InlineKeyboardButton(c, callback_data=f"ans:{c}")] for c in choices]
        await send(text, InlineKeyboardMarkup(buttons))
    else:
        await send(text)


async def deliver_all(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int, payloads: list[dict]):
    """Deliver all payloads to student in order."""
    for payload in payloads:
        await deliver(ctx, chat_id, payload)


async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    global active_chat_id
    chat_id = update.effective_user.id

    if active_chat_id and active_chat_id != chat_id:
        await update.message.reply_text("⏳ มีนักเรียนอยู่ใน session แล้วครับ กรุณารอสักครู่...")
        return

    active_chat_id = chat_id
    session_state[chat_id] = "waiting_payment"
    log.info(f"New session: chat_id={chat_id}, triggering payment check")

    cost_line = f"💰 ค่าบริการ: {_initial_capital} (ชำระผ่าน BNB Chain)" if _initial_capital != "$0" else "🎉 บริการนี้ไม่มีค่าใช้จ่ายครับ"
    welcome = (
        f"👋 ยินดีต้อนรับสู่ {_job_name}!\n\n"
        f"📚 เราจะเรียนคำศัพท์ภาษาอังกฤษ 10 คำต่อ session\n"
        f"   แต่ละข้อมี 4 ตัวเลือก พร้อมเฉลยทันทีหลังตอบ\n\n"
        f"{cost_line}\n\n"
        f"⏳ กำลังตรวจสอบข้อมูล..."
    )
    await update.message.reply_text(welcome)

    payloads = await send_with_typing(ctx, chat_id, START_TRIGGER)
    await deliver_all(ctx, chat_id, payloads)

    ptype = payloads[0].get("type", "text") if payloads else "text"

    if ptype == "payment_ok":
        await _start_lesson(ctx, chat_id)
    else:
        session_state[chat_id] = "waiting_payment"


async def _start_lesson(ctx: ContextTypes.DEFAULT_TYPE, chat_id: int):
    """Prime agent as teacher and send first question."""
    global session_state
    session_state[chat_id] = "in_lesson"

    # Prime silently (no typing indicator — student doesn't see this exchange)
    await asyncio.to_thread(send_to_agent, TEACHER_CONTEXT)

    payloads = await send_with_typing(ctx, chat_id, "เริ่มโจทย์ข้อที่ 1 ได้เลยครับ")
    await deliver_all(ctx, chat_id, payloads)


async def handle_answer(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    global active_chat_id
    query = update.callback_query
    await query.answer()
    chat_id = query.from_user.id

    if active_chat_id != chat_id or session_state.get(chat_id) != "in_lesson":
        return

    chosen = query.data.replace("ans:", "")
    await query.edit_message_reply_markup(reply_markup=None)

    payloads = await send_with_typing(ctx, chat_id, f"answer:{chosen}")
    await deliver_all(ctx, chat_id, payloads)

    if any(p.get("type") == "summary" for p in payloads):
        await asyncio.to_thread(send_to_agent, "/end")
        active_chat_id = None
        session_state.pop(chat_id, None)
        log.info(f"Session ended: chat_id={chat_id}")


async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    global active_chat_id
    chat_id = update.effective_user.id
    text = update.message.text.strip()

    if active_chat_id != chat_id:
        if active_chat_id is not None:
            await update.message.reply_text("⏳ มีนักเรียนอยู่ใน session แล้วครับ กรุณารอสักครู่...")
        else:
            await update.message.reply_text("กรุณาพิมพ์ /start เพื่อเริ่มเรียนครับ 📖")
        return

    state = session_state.get(chat_id, "in_lesson")

    if state == "waiting_payment":
        payloads = await send_with_typing(ctx, chat_id, text)
        await deliver_all(ctx, chat_id, payloads)

        ptype = payloads[0].get("type", "text") if payloads else "text"
        if ptype == "payment_ok":
            await _start_lesson(ctx, chat_id)
        return

    # in_lesson
    payloads = await send_with_typing(ctx, chat_id, text)
    await deliver_all(ctx, chat_id, payloads)

    if any(p.get("type") == "summary" for p in payloads):
        await asyncio.to_thread(send_to_agent, "/end")
        active_chat_id = None
        session_state.pop(chat_id, None)


def main():
    log.info(f"Starting bot | session={SESSION_ID} | gateway={HELL_FACTORY_URL}")
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_answer, pattern=r"^ans:"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
