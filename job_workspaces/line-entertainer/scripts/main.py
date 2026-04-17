#!/usr/bin/env python3
"""
LINE Group Chat Entertainer Bot
================================
A Flask webhook server that handles LINE Messaging API events.

Features:
- Handles multiple LINE groups simultaneously (stateless via group_id)
- Per-group persona customization
- Mini-games: number guessing, trivia, word games
- Greeting on join/leave events
- --dry-run mode (starts server but logs instead of sending real replies)

Usage:
    python3 scripts/main.py                    # production
    python3 scripts/main.py --dry-run          # test mode
    python3 scripts/main.py --port 8080        # custom port
    python3 scripts/main.py --dry-run --port 8080
"""

import argparse
import logging
import os
import random
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Load .env before any LINE SDK imports
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / "config" / ".env"

try:
    from dotenv import load_dotenv
    load_dotenv(ENV_FILE)
except ImportError:
    print("WARNING: python-dotenv not installed. Run bash scripts/setup.sh first.")

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
LOG_DIR = PROJECT_ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "bot.log"),
    ],
)
logger = logging.getLogger("line-entertainer")

# ---------------------------------------------------------------------------
# LINE SDK imports
# ---------------------------------------------------------------------------
try:
    from linebot.v3 import WebhookHandler
    from linebot.v3.exceptions import InvalidSignatureError
    from linebot.v3.messaging import (
        ApiClient,
        Configuration,
        MessagingApi,
        ReplyMessageRequest,
        TextMessage,
    )
    from linebot.v3.webhooks import (
        FollowEvent,
        JoinEvent,
        LeaveEvent,
        MemberJoinedEvent,
        MemberLeftEvent,
        MessageEvent,
        TextMessageContent,
    )
    LINE_SDK_AVAILABLE = True
except ImportError as e:
    logger.warning(f"LINE SDK not installed: {e}. Run bash scripts/setup.sh")
    LINE_SDK_AVAILABLE = False

from flask import Flask, abort, jsonify, request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")

# ---------------------------------------------------------------------------
# Per-group persona config
# ---------------------------------------------------------------------------
# Add your actual group IDs here as keys.
# Find group IDs in logs/bot.log after the first message in each group.
GROUP_PERSONAS: dict[str, dict] = {
    # Example custom persona:
    # "C1234567890abcdef": {
    #     "name": "TukTuk",
    #     "style": "funny",
    #     "greeting": "Sawasdee krub! TukTuk yoo tee nee laew! 🎉"
    # },
    "default": {
        "name": "Nong Bot",
        "style": "friendly",
        "greeting": "Sawasdee krub! 👋 I'm Nong Bot, your group entertainer! Type !help to see what I can do.",
    },
}

# ---------------------------------------------------------------------------
# Entertainment content
# ---------------------------------------------------------------------------
JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
    "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
    "Why did the developer go broke? Because he used up all his cache! 💸",
    "How do you comfort a JavaScript bug? You console it. 😄",
    "Why did the programmer quit his job? Because he didn't get arrays (a raise)! 📈",
    "What's a computer's favorite snack? Microchips! 🍟",
    "I told my wife she was drawing her eyebrows too high. She looked surprised. 😮",
    "Why don't scientists trust atoms? Because they make up everything! ⚛️",
]

TRIVIA_QNA = [
    {
        "q": "What is the capital city of Thailand?",
        "a": "Bangkok",
        "hint": "It starts with B and has a very very long official name!"
    },
    {
        "q": "How many colors are in a rainbow?",
        "a": "7",
        "hint": "ROYGBIV!"
    },
    {
        "q": "What programming language is LINE Bot SDK originally built for?",
        "a": "Java",
        "hint": "It starts with J, and no it's not JavaScript!"
    },
    {
        "q": "In which year was LINE messaging app launched?",
        "a": "2011",
        "hint": "It was launched after a natural disaster in Japan"
    },
    {
        "q": "What does 'API' stand for?",
        "a": "Application Programming Interface",
        "hint": "Think of it as a waiter taking orders between kitchen (server) and customers"
    },
    {
        "q": "What is 7 x 8?",
        "a": "56",
        "hint": "5... something..."
    },
]

FUN_FACTS = [
    "Did you know? LINE was originally developed by NHN Japan (now LINE Corporation) and launched on June 23, 2011!",
    "Fun fact: LINE has over 200 million active users, mostly in Thailand, Japan, Taiwan, and Indonesia!",
    "Did you know? The LINE app logo is green because it was inspired by 'going green' / eco-friendliness!",
    "Fun fact: LINE stickers were invented because the founder's daughter wanted to express emotions better than emoji!",
    "Did you know? A group of flamingos is called a 'flamboyance'! 🦩",
    "Fun fact: Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs, still perfectly edible! 🍯",
]

HELP_TEXT = """
🤖 *Nong Bot Commands*

🎮 *Games:*
  !guess — Start number guessing game (1-100)
  !answer <number> — Submit your guess
  !trivia — Get a trivia question
  !trivia hint — Get a hint for current trivia

😄 *Entertainment:*
  !joke — Get a random joke
  !fact — Get a fun fact
  !roll — Roll a random dice (1-6)
  !flip — Flip a coin

ℹ️ *Info:*
  !help — Show this menu
  !info — Bot info & group persona
  !ping — Check if bot is alive
""".strip()

# ---------------------------------------------------------------------------
# In-memory game state per group (resets on restart — fine for demo)
# ---------------------------------------------------------------------------
# group_id -> {"game": "guess", "answer": 42, "started_by": "user_id"}
group_game_state: dict[str, dict] = {}
# group_id -> trivia question index
group_trivia_state: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Helper: get persona for group
# ---------------------------------------------------------------------------
def get_persona(group_id: str) -> dict:
    return GROUP_PERSONAS.get(group_id, GROUP_PERSONAS["default"])


# ---------------------------------------------------------------------------
# Core reply logic
# ---------------------------------------------------------------------------
def generate_reply(
    text: str,
    group_id: str,
    user_id: str,
    display_name: str = "friend",
) -> str | None:
    """
    Generate a reply message given input text in a group.
    Returns reply text string, or None if bot should stay silent.
    """
    text_lower = text.lower().strip()
    persona = get_persona(group_id)
    bot_name = persona["name"]

    logger.info(
        f"[GROUP:{group_id[:8]}...] [{user_id[:8]}...] text={repr(text)}"
    )

    # --- Commands ---
    if text_lower == "!help":
        return HELP_TEXT.replace("Nong Bot", bot_name)

    if text_lower == "!ping":
        return f"🏓 Pong! {bot_name} is alive and kicking, {display_name}!"

    if text_lower == "!info":
        return (
            f"🤖 Bot: *{bot_name}*\n"
            f"🎭 Style: {persona['style']}\n"
            f"🆔 Group ID: {group_id[:16]}...\n"
            f"📌 Type !help to see all commands"
        )

    if text_lower == "!joke":
        return random.choice(JOKES)

    if text_lower == "!fact":
        return random.choice(FUN_FACTS)

    if text_lower == "!roll":
        num = random.randint(1, 6)
        faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"]
        return f"🎲 {display_name} rolled a {faces[num-1]} ({num})!"

    if text_lower == "!flip":
        result = random.choice(["Heads 🪙", "Tails 🪙"])
        return f"🪙 {display_name} flipped a coin... It's {result}!"

    # --- Number guessing game ---
    if text_lower == "!guess":
        answer = random.randint(1, 100)
        group_game_state[group_id] = {
            "game": "guess",
            "answer": answer,
            "started_by": user_id,
            "attempts": 0,
        }
        return (
            f"🎮 Number Guessing Game started by {display_name}!\n"
            f"I'm thinking of a number between 1 and 100.\n"
            f"Type !answer <number> to guess! (e.g. !answer 42)"
        )

    if text_lower.startswith("!answer "):
        if group_id not in group_game_state or group_game_state[group_id].get("game") != "guess":
            return "❓ No guessing game active! Type !guess to start one."
        try:
            guess = int(text_lower.split("!answer ", 1)[1].strip())
        except ValueError:
            return "❓ Please type a number! e.g. !answer 42"

        state = group_game_state[group_id]
        state["attempts"] = state.get("attempts", 0) + 1
        answer = state["answer"]
        attempts = state["attempts"]

        if guess == answer:
            del group_game_state[group_id]
            return (
                f"🎉 Correct, {display_name}! The number was {answer}!\n"
                f"You got it in {attempts} attempt{'s' if attempts != 1 else ''}! 🏆"
            )
        elif guess < answer:
            return f"📈 {display_name}'s guess ({guess}) is too LOW! Try higher. (Attempt #{attempts})"
        else:
            return f"📉 {display_name}'s guess ({guess}) is too HIGH! Try lower. (Attempt #{attempts})"

    # --- Trivia game ---
    if text_lower == "!trivia":
        qna = random.choice(TRIVIA_QNA)
        group_trivia_state[group_id] = {"qna": qna, "answered": False}
        return (
            f"🧠 *TRIVIA TIME!*\n\n"
            f"❓ {qna['q']}\n\n"
            f"Reply with the answer directly, or type !trivia hint for a clue!"
        )

    if text_lower == "!trivia hint":
        if group_id not in group_trivia_state:
            return "❓ No trivia active! Type !trivia to start one."
        qna = group_trivia_state[group_id]["qna"]
        return f"💡 Hint: {qna['hint']}"

    # --- Check if message is a trivia answer ---
    if group_id in group_trivia_state and not group_trivia_state[group_id].get("answered"):
        qna = group_trivia_state[group_id]["qna"]
        if text_lower == qna["a"].lower() or qna["a"].lower() in text_lower:
            group_trivia_state[group_id]["answered"] = True
            return (
                f"🎉 CORRECT, {display_name}! The answer is: *{qna['a']}* 🏆\n"
                f"Type !trivia for another question!"
            )

    # --- Natural keyword responses ---
    keywords_responses = {
        ("hello", "hi", "hey", "sawasdee", "สวัสดี"): [
            f"Hello {display_name}! 👋 How are you today?",
            f"Hey {display_name}! 😄 Great to see you here!",
            f"Sawasdee! 🙏 Welcome {display_name}!",
        ],
        ("how are you", "เป็นยังไงบ้าง", "sabai dee bor"): [
            "I'm doing great, thanks for asking! 😄 Always happy to chat!",
            "Feeling fantastic! Ready to entertain this group! 🎉",
            "Never better! What can I do for you today?",
        ],
        ("thank", "thanks", "ขอบคุณ", "khob khun"): [
            f"You're welcome, {display_name}! 😊 Always happy to help!",
            f"Anytime, {display_name}! That's what I'm here for! 🤖",
            f"No problem at all! 🙏",
        ],
        ("good morning", "อรุณสวัสดิ์", "สวัสดีตอนเช้า"): [
            f"Good morning, {display_name}! ☀️ Hope you have an amazing day!",
            f"Rise and shine, {display_name}! 🌅 Ready for a great day?",
        ],
        ("good night", "ราตรีสวัสดิ์", "ฝันดี"): [
            f"Good night, {display_name}! 🌙 Sweet dreams! 💤",
            f"Sleep well, {display_name}! 😴 See you tomorrow!",
        ],
        ("love", "รัก", "ชอบ"): [
            "Love is in the air! 💕 This group is full of good vibes!",
            "Aww 🥰 Spread the love everyone!",
        ],
        ("food", "กิน", "อาหาร", "ข้าว", "หิว"): [
            "Hungry?! 🍜 Time for some Thai food! Pad Thai? Tom Yum?",
            "Food talk! 🍱 My favorite topic... even though I'm a bot and can't eat 😢",
            "Did someone say FOOD?! 🍕🍣🌮 I'm virtually hungry now!",
        ],
        ("boring", "เบื่อ", "bored"): [
            "Bored?! 😱 Let me fix that! Type !joke for a laugh or !trivia for a challenge!",
            "No time to be bored here! 🎮 Type !help to see all the fun things we can do!",
        ],
    }

    for keywords, responses in keywords_responses.items():
        if any(kw in text_lower for kw in keywords):
            return random.choice(responses)

    # --- Bot name mention ---
    if bot_name.lower() in text_lower:
        name_responses = [
            f"Did someone call me? 😊 I'm {bot_name}! Type !help to see what I can do!",
            f"Yes? You called {bot_name}? How can I help? 🤖",
            f"That's my name! 😄 Need something, {display_name}?",
        ]
        return random.choice(name_responses)

    # Stay silent for messages we don't recognize (avoid spam)
    return None


# ---------------------------------------------------------------------------
# Flask app factory
# ---------------------------------------------------------------------------
def create_app(dry_run: bool = False) -> Flask:
    app = Flask(__name__)
    app.config["DRY_RUN"] = dry_run

    if not LINE_SDK_AVAILABLE:
        logger.error("LINE SDK not available. Run bash scripts/setup.sh")
        if not dry_run:
            sys.exit(1)
        # In dry-run mode, still start the server for testing
        @app.route("/health")
        def health_nodeps():
            return jsonify({"status": "ok", "dry_run": True, "sdk": "not installed"})
        return app

    # --- Validate credentials ---
    if not LINE_CHANNEL_SECRET and not dry_run:
        logger.error("LINE_CHANNEL_SECRET not set. Check config/.env")
        sys.exit(1)
    if not LINE_CHANNEL_ACCESS_TOKEN and not dry_run:
        logger.error("LINE_CHANNEL_ACCESS_TOKEN not set. Check config/.env")
        sys.exit(1)

    # Use dummy values in dry-run mode if not set
    channel_secret = LINE_CHANNEL_SECRET or "dry_run_dummy_secret_32characters!!"
    channel_token = LINE_CHANNEL_ACCESS_TOKEN or "dry_run_dummy_token"

    # --- LINE SDK setup ---
    handler = WebhookHandler(channel_secret)
    configuration = Configuration(access_token=channel_token)

    def send_reply(reply_token: str, text: str) -> None:
        """Send a reply message. In dry-run mode, just log it."""
        if app.config["DRY_RUN"]:
            logger.info(f"[DRY-RUN] Would reply: {repr(text)}")
            return
        with ApiClient(configuration) as api_client:
            line_bot_api = MessagingApi(api_client)
            line_bot_api.reply_message(
                ReplyMessageRequest(
                    reply_token=reply_token,
                    messages=[TextMessage(text=text)],
                )
            )

    # --- Webhook route ---
    @app.route("/webhook", methods=["POST"])
    def webhook():
        signature = request.headers.get("X-Line-Signature", "")
        body = request.get_data(as_text=True)
        logger.debug(f"Webhook received: {body[:200]}")

        try:
            handler.handle(body, signature)
        except InvalidSignatureError:
            logger.warning("Invalid signature received — rejected request")
            abort(400)
        except Exception as e:
            logger.exception(f"Error handling webhook: {e}")
            abort(500)

        return "OK"

    # --- Health check ---
    @app.route("/health")
    def health():
        return jsonify({
            "status": "ok",
            "dry_run": app.config["DRY_RUN"],
            "sdk_available": LINE_SDK_AVAILABLE,
            "channel_configured": bool(LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN),
        })

    # --- Event handlers ---
    @handler.add(JoinEvent)
    def handle_join(event):
        """Bot was added to a group."""
        source = event.source
        group_id = getattr(source, "group_id", None) or getattr(source, "room_id", "unknown")
        logger.info(f"[JOIN] Bot joined group: {group_id}")

        persona = get_persona(group_id)
        reply_text = persona.get("greeting", GROUP_PERSONAS["default"]["greeting"])
        send_reply(event.reply_token, reply_text)

    @handler.add(LeaveEvent)
    def handle_leave(event):
        """Bot was removed from a group."""
        source = event.source
        group_id = getattr(source, "group_id", None) or getattr(source, "room_id", "unknown")
        logger.info(f"[LEAVE] Bot left/was removed from group: {group_id}")
        # Cannot reply after being kicked (no reply token is valid), just log.

    @handler.add(MemberJoinedEvent)
    def handle_member_joined(event):
        """A user joined the group."""
        source = event.source
        group_id = getattr(source, "group_id", None) or "unknown"
        joined = event.joined.members if hasattr(event, "joined") else []
        names = [getattr(m, "display_name", "someone") for m in joined]
        logger.info(f"[MEMBER_JOIN] Group:{group_id} Members joined: {names}")

        if names:
            name_str = ", ".join(names) if len(names) < 4 else f"{len(names)} new members"
            send_reply(
                event.reply_token,
                f"👋 Welcome to the group, {name_str}! 🎉 I'm your group entertainer — type !help to see what I can do!"
            )

    @handler.add(MemberLeftEvent)
    def handle_member_left(event):
        """A user left the group."""
        source = event.source
        group_id = getattr(source, "group_id", None) or "unknown"
        logger.info(f"[MEMBER_LEFT] Group:{group_id}")
        # MemberLeftEvent has no reply_token (LINE limitation), just log.

    @handler.add(FollowEvent)
    def handle_follow(event):
        """User added bot as friend (1:1 chat)."""
        logger.info(f"[FOLLOW] user_id={event.source.user_id}")
        send_reply(
            event.reply_token,
            "Hello! 👋 I'm Nong Bot, your LINE entertainer!\n"
            "Add me to a group and I'll keep everyone entertained!\n"
            "Type !help to see all my commands.",
        )

    @handler.add(MessageEvent, message=TextMessageContent)
    def handle_text_message(event):
        """Handle text messages in groups and DMs."""
        source = event.source
        text = event.message.text
        user_id = getattr(source, "user_id", "unknown")
        group_id = (
            getattr(source, "group_id", None)
            or getattr(source, "room_id", None)
            or f"dm_{user_id}"
        )

        logger.info(f"[MSG] group={group_id[:12]}... user={user_id[:8]}... text={repr(text[:50])}")

        # Get display name (best effort)
        display_name = "friend"

        reply_text = generate_reply(text, group_id, user_id, display_name)

        if reply_text:
            send_reply(event.reply_token, reply_text)
        else:
            logger.debug(f"[MSG] No reply generated for: {repr(text)}")

    return app


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="LINE Group Chat Entertainer Bot",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Start server but don't send real LINE replies (log only)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", 5000)),
        help="Port to listen on (default: 5000 or $PORT)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable Flask debug mode",
    )
    args = parser.parse_args()

    if args.dry_run:
        logger.info("=" * 50)
        logger.info("  DRY-RUN MODE — No real LINE replies will be sent")
        logger.info("=" * 50)

    app = create_app(dry_run=args.dry_run)

    logger.info(f"Starting LINE Entertainer Bot on {args.host}:{args.port}")
    logger.info(f"Webhook endpoint: http://{args.host}:{args.port}/webhook")
    logger.info(f"Health endpoint:  http://{args.host}:{args.port}/health")

    app.run(
        host=args.host,
        port=args.port,
        debug=args.debug,
    )


if __name__ == "__main__":
    main()
