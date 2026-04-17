#!/usr/bin/env python3
"""
Shopee CS Bot — Automated Customer Service via Shopee Open API v2

Polls Shopee seller chat, classifies buyer messages, and sends auto-replies.

Usage:
    python3 scripts/main.py              # run bot (real mode)
    python3 scripts/main.py --dry-run    # log only, no messages sent
    python3 scripts/main.py --once       # poll once and exit (for cron)
    python3 scripts/main.py --refresh-token-only  # refresh access token and exit
"""

import argparse
import hashlib
import hmac
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Load .env before anything else
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
except ImportError:
    print("[ERROR] python-dotenv not installed. Run: bash scripts/setup.sh")
    sys.exit(1)

# Resolve .env relative to this script's project root
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
_ENV_PATH = _PROJECT_DIR / "config" / ".env"

if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)
else:
    load_dotenv()  # fallback: look in cwd / system env

# ---------------------------------------------------------------------------
# Setup logging with colorlog if available
# ---------------------------------------------------------------------------
try:
    import colorlog

    _handler = colorlog.StreamHandler()
    _handler.setFormatter(
        colorlog.ColoredFormatter(
            "%(log_color)s%(asctime)s [%(levelname)s]%(reset)s %(message)s",
            datefmt="%H:%M:%S",
            log_colors={
                "DEBUG": "cyan",
                "INFO": "green",
                "WARNING": "yellow",
                "ERROR": "red",
                "CRITICAL": "bold_red",
            },
        )
    )
except ImportError:
    _handler = logging.StreamHandler()
    _handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
    )

_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, _LOG_LEVEL, logging.INFO), handlers=[_handler])
log = logging.getLogger("shopee-cs-bot")

# Also log to file
_LOG_DIR = _PROJECT_DIR / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_file_handler = logging.FileHandler(_LOG_DIR / "bot.log")
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
)
log.addHandler(_file_handler)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
def _safe_int(val: str, default: int = 0) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


PARTNER_ID: int = _safe_int(os.getenv("SHOPEE_PARTNER_ID", "0"))
PARTNER_KEY: str = os.getenv("SHOPEE_PARTNER_KEY", "")
SHOP_ID: int = _safe_int(os.getenv("SHOPEE_SHOP_ID", "0"))
ACCESS_TOKEN: str = os.getenv("SHOPEE_ACCESS_TOKEN", "")
REFRESH_TOKEN: str = os.getenv("SHOPEE_REFRESH_TOKEN", "")

TEST_MODE: bool = os.getenv("SHOPEE_TEST_MODE", "false").lower() == "true"
POLL_INTERVAL: int = int(os.getenv("POLL_INTERVAL_SECONDS", "60"))
AUTO_REPLY_ENABLED: bool = os.getenv("AUTO_REPLY_ENABLED", "true").lower() == "true"

BASE_URL = (
    "https://partner.test-stable.shopeemobile.com/api/v2"
    if TEST_MODE
    else "https://partner.shopeemobile.com/api/v2"
)

# ---------------------------------------------------------------------------
# Reply templates (Thai + English bilingual — common in Thai Shopee shops)
# ---------------------------------------------------------------------------
REPLY_TEMPLATES = {
    "pricing": (
        "สวัสดีค่ะ ขอบคุณที่สอบถามนะคะ 😊\n"
        "ราคาสินค้าแสดงอยู่บนหน้าสินค้าเลยค่ะ หากต้องการสั่งซื้อหลายชิ้น "
        "กรุณาทักมาสอบถามได้เลยนะคะ เราจะแจ้งราคาพิเศษให้ค่ะ\n"
        "Hello! Thank you for asking. Prices are listed on the product page. "
        "For bulk orders, please message us for special pricing!"
    ),
    "delivery": (
        "สวัสดีค่ะ ขอบคุณที่ติดตามคำสั่งซื้อนะคะ 📦\n"
        "สามารถติดตามพัสดุได้ที่แถบ 'คำสั่งซื้อของฉัน' ในแอป Shopee ค่ะ "
        "หากมีปัญหาเรื่องการจัดส่ง กรุณาแจ้งให้ทราบด้วยนะคะ\n"
        "Hi! You can track your order in 'My Orders' on the Shopee app. "
        "If you have a shipping issue, please let us know!"
    ),
    "return": (
        "สวัสดีค่ะ ขอโทษที่ทำให้ไม่สะดวกนะคะ 🙏\n"
        "หากต้องการคืนสินค้าหรือขอคืนเงิน กรุณาเปิดคำร้องผ่านระบบ Shopee "
        "ภายใน 15 วันนับจากได้รับสินค้าค่ะ ทีมงานจะติดต่อกลับโดยเร็วที่สุดค่ะ\n"
        "Hi! Sorry for the inconvenience. To request a return/refund, please open "
        "a dispute via the Shopee app within 15 days of receiving the item."
    ),
    "other": (
        "สวัสดีค่ะ ขอบคุณที่ติดต่อเข้ามานะคะ 😊\n"
        "ทีมงานได้รับข้อความของคุณแล้ว และจะรีบตอบกลับโดยเร็วที่สุดค่ะ\n"
        "Hello! Thank you for contacting us. We've received your message "
        "and will reply as soon as possible. Have a great day!"
    ),
}

# Intent classification keywords (Thai + English)
INTENT_KEYWORDS = {
    "pricing": [
        "ราคา", "price", "ลด", "discount", "promo", "โปรโมชั่น", "sale",
        "เท่าไหร่", "เท่าไร", "how much", "cost", "ค่าใช้จ่าย", "ถูกกว่า",
    ],
    "delivery": [
        "ส่ง", "shipping", "จัดส่ง", "delivery", "track", "ติดตาม", "พัสดุ",
        "เมื่อไหร่", "when", "ได้รับ", "receive", "ขนส่ง", "logistic",
        "ems", "kerry", "flash", "j&t", "ไปรษณีย์",
    ],
    "return": [
        "คืน", "return", "refund", "คืนเงิน", "เสีย", "broken", "defect",
        "เสียหาย", "ไม่ตรงปก", "ผิด", "wrong item", "ของปลอม", "fake",
        "เปลี่ยน", "exchange", "ร้องเรียน", "complaint",
    ],
}

# ---------------------------------------------------------------------------
# Signature generation (Shopee Open API v2 HMAC-SHA256)
# ---------------------------------------------------------------------------

def generate_signature(path: str, timestamp: int, access_token: str = "", shop_id: int = 0) -> str:
    """
    Shopee v2 signature:
        base_string = partner_id + path + timestamp + access_token + shop_id
        sign = HMAC-SHA256(partner_key, base_string).hexdigest()
    """
    base_string = f"{PARTNER_ID}{path}{timestamp}{access_token}{shop_id}"
    sign = hmac.new(
        PARTNER_KEY.encode("utf-8"),
        base_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return sign


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get_common_params(path: str, timestamp: int) -> dict:
    sign = generate_signature(path, timestamp, ACCESS_TOKEN, SHOP_ID)
    return {
        "partner_id": PARTNER_ID,
        "timestamp": timestamp,
        "access_token": ACCESS_TOKEN,
        "shop_id": SHOP_ID,
        "sign": sign,
    }


def shopee_get(path: str, extra_params: Optional[dict] = None) -> dict:
    """Make an authenticated GET request to Shopee Open API v2."""
    import requests

    url = BASE_URL + path
    timestamp = int(time.time())
    params = _get_common_params(path, timestamp)
    if extra_params:
        params.update(extra_params)

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as exc:
        log.error("GET %s failed: %s", path, exc)
        return {"error": str(exc)}


def shopee_post(path: str, payload: dict) -> dict:
    """Make an authenticated POST request to Shopee Open API v2."""
    import requests

    url = BASE_URL + path
    timestamp = int(time.time())
    params = _get_common_params(path, timestamp)

    try:
        resp = requests.post(url, params=params, json=payload, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as exc:
        log.error("POST %s failed: %s", path, exc)
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

def refresh_access_token() -> bool:
    """
    Refresh the access_token using refresh_token.
    Updates the module-level ACCESS_TOKEN variable.
    Returns True if successful.

    Endpoint: POST /auth/access_token/get
    """
    global ACCESS_TOKEN

    path = "/auth/access_token/get"
    url = BASE_URL + path
    timestamp = int(time.time())

    import requests

    sign = generate_signature(path, timestamp)
    params = {
        "partner_id": PARTNER_ID,
        "timestamp": timestamp,
        "sign": sign,
    }
    payload = {
        "refresh_token": REFRESH_TOKEN,
        "partner_id": PARTNER_ID,
        "shop_id": SHOP_ID,
    }

    try:
        resp = requests.post(url, params=params, json=payload, timeout=15)
        data = resp.json()
        new_token = data.get("access_token")
        if new_token:
            ACCESS_TOKEN = new_token
            log.info("Access token refreshed successfully")
            # Optionally persist to .env (not done here to keep it simple)
            return True
        else:
            log.warning("Token refresh response missing access_token: %s", data)
            return False
    except Exception as exc:
        log.error("Token refresh failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

def classify_message(text: str) -> str:
    """
    Classify message intent: pricing | delivery | return | other

    Simple keyword matching. Extend with ML/NLP for better accuracy.
    """
    text_lower = text.lower()
    scores = {intent: 0 for intent in INTENT_KEYWORDS}

    for intent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text_lower:
                scores[intent] += 1

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "other"
    return best


# ---------------------------------------------------------------------------
# Shopee Chat API calls
# ---------------------------------------------------------------------------

def get_conversation_list(page_size: int = 25) -> list:
    """
    GET /sellerchat/get_conversation_list
    Returns list of conversations with unread messages.
    """
    path = "/sellerchat/get_conversation_list"
    result = shopee_get(path, {
        "page_size": page_size,
        "filter": "unread",   # only fetch unread conversations
    })

    if "error" in result:
        log.error("Failed to get conversation list: %s", result["error"])
        return []

    error_code = result.get("error", 0)
    if error_code and error_code != 0:
        log.warning("API error on get_conversation_list: %s — %s", error_code, result.get("message"))
        return []

    conversations = result.get("response", {}).get("conversations", [])
    log.debug("Fetched %d conversations", len(conversations))
    return conversations


def get_messages(conversation_id: str, page_size: int = 25) -> list:
    """
    GET /sellerchat/get_message
    Returns messages in a conversation.
    """
    path = "/sellerchat/get_message"
    result = shopee_get(path, {
        "conversation_id": conversation_id,
        "page_size": page_size,
    })

    if "error" in result:
        log.error("Failed to get messages for conv %s: %s", conversation_id, result["error"])
        return []

    messages = result.get("response", {}).get("messages", [])
    log.debug("Fetched %d messages from conversation %s", len(messages), conversation_id)
    return messages


def send_message(conversation_id: str, message_text: str, dry_run: bool = False) -> bool:
    """
    POST /sellerchat/send_message
    Sends a text reply to a buyer in a conversation.
    Returns True on success.
    """
    if dry_run:
        log.info(
            "[DRY-RUN] Would send to conv %s:\n  >>> %s",
            conversation_id,
            message_text[:120] + "..." if len(message_text) > 120 else message_text,
        )
        return True

    path = "/sellerchat/send_message"
    payload = {
        "conversation_id": conversation_id,
        "message_type": "text",
        "content": {"text": message_text},
    }
    result = shopee_post(path, payload)

    if "error" in result and result["error"]:
        log.error("Failed to send message to conv %s: %s", conversation_id, result)
        return False

    log.info("Sent reply to conversation %s", conversation_id)
    return True


def mark_conversation_read(conversation_id: str) -> None:
    """POST /sellerchat/read_conversation — mark as read."""
    path = "/sellerchat/read_conversation"
    shopee_post(path, {"conversation_id": conversation_id, "last_read_message_id": ""})


# ---------------------------------------------------------------------------
# Mock data for --dry-run when credentials are placeholder values
# ---------------------------------------------------------------------------

MOCK_CONVERSATIONS = [
    {
        "conversation_id": "MOCK_CONV_001",
        "buyer_user_id": 11111,
        "buyer_username": "mock_buyer_1",
        "unread_count": 1,
    },
    {
        "conversation_id": "MOCK_CONV_002",
        "buyer_user_id": 22222,
        "buyer_username": "mock_buyer_2",
        "unread_count": 1,
    },
    {
        "conversation_id": "MOCK_CONV_003",
        "buyer_user_id": 33333,
        "buyer_username": "mock_buyer_3",
        "unread_count": 1,
    },
]

MOCK_MESSAGES = {
    "MOCK_CONV_001": [
        {"message_id": "M001", "from_id": 11111, "content": {"text": "ราคาสินค้านี้เท่าไหร่ครับ ลดได้ไหม"}, "type": "text"},
    ],
    "MOCK_CONV_002": [
        {"message_id": "M002", "from_id": 22222, "content": {"text": "ส่งของแล้วยัง ติดตาม tracking ได้ที่ไหน"}, "type": "text"},
    ],
    "MOCK_CONV_003": [
        {"message_id": "M003", "from_id": 33333, "content": {"text": "สินค้าเสียหาย ต้องการคืนสินค้า refund ด้วยค่ะ"}, "type": "text"},
    ],
}


def _is_placeholder_credentials() -> bool:
    return (
        PARTNER_ID == 0
        or not PARTNER_KEY
        or "your_" in PARTNER_KEY
        or SHOP_ID == 0
        or not ACCESS_TOKEN
        or "your_" in ACCESS_TOKEN
    )


# ---------------------------------------------------------------------------
# Main poll loop
# ---------------------------------------------------------------------------

def poll_and_reply(dry_run: bool = False) -> int:
    """
    Poll for unread conversations, classify messages, send replies.
    Returns number of conversations processed.
    """
    use_mock = dry_run and _is_placeholder_credentials()

    if use_mock:
        log.info("[DRY-RUN + MOCK] Using mock data (no real credentials configured)")
        conversations = MOCK_CONVERSATIONS
    else:
        log.debug("Polling Shopee seller chat...")
        conversations = get_conversation_list()

    if not conversations:
        log.info("No unread conversations found")
        return 0

    log.info("Found %d conversation(s) with unread messages", len(conversations))
    processed = 0

    for conv in conversations:
        conv_id = conv.get("conversation_id") or conv.get("id", "")
        buyer_name = conv.get("buyer_username") or conv.get("buyer_user_id", "unknown")

        if use_mock:
            messages = MOCK_MESSAGES.get(conv_id, [])
        else:
            messages = get_messages(conv_id)

        if not messages:
            continue

        # Get the latest message from the buyer (from_id != shop/seller)
        buyer_messages = [
            m for m in messages
            if m.get("from_id") != SHOP_ID and m.get("type") == "text"
        ]
        if not buyer_messages:
            # For mock, include all
            if use_mock:
                buyer_messages = messages
            else:
                continue

        latest = buyer_messages[-1]
        text = latest.get("content", {}).get("text", "")

        if not text:
            log.debug("Conv %s: empty message, skipping", conv_id)
            continue

        intent = classify_message(text)
        reply = REPLY_TEMPLATES[intent]

        log.info(
            "Conv %s | Buyer: %s | Intent: %-10s | Msg: %.60s...",
            conv_id,
            buyer_name,
            intent.upper(),
            text,
        )

        if AUTO_REPLY_ENABLED or dry_run:
            ok = send_message(conv_id, reply, dry_run=dry_run)
            if ok and not dry_run:
                mark_conversation_read(conv_id)
        else:
            log.info("AUTO_REPLY_ENABLED=false — skipping send")

        processed += 1

    return processed


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def validate_config(dry_run: bool) -> bool:
    """Warn if credentials look like placeholders."""
    issues = []
    if PARTNER_ID == 0:
        issues.append("SHOPEE_PARTNER_ID is 0 (not set)")
    if not PARTNER_KEY or "your_" in PARTNER_KEY:
        issues.append("SHOPEE_PARTNER_KEY is not set")
    if SHOP_ID == 0:
        issues.append("SHOPEE_SHOP_ID is 0 (not set)")
    if not ACCESS_TOKEN or "your_" in ACCESS_TOKEN:
        issues.append("SHOPEE_ACCESS_TOKEN is not set")
    if not REFRESH_TOKEN or "your_" in REFRESH_TOKEN:
        issues.append("SHOPEE_REFRESH_TOKEN is not set")

    if issues:
        if dry_run:
            log.warning("Credentials not configured — running with MOCK DATA:")
            for issue in issues:
                log.warning("  - %s", issue)
            return True  # Allow dry-run with mock
        else:
            log.error("Missing credentials — cannot run in real mode:")
            for issue in issues:
                log.error("  - %s", issue)
            log.error("Run 'bash scripts/setup.sh' and configure config/.env")
            return False
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Shopee CS Bot — Automated Customer Service via Shopee Open API v2"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log replies without sending them. Uses mock data if credentials not set.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Poll once and exit (useful for cron jobs).",
    )
    parser.add_argument(
        "--refresh-token-only",
        action="store_true",
        help="Refresh the access token and exit.",
    )
    args = parser.parse_args()

    log.info("=" * 50)
    log.info("Shopee CS Bot starting up")
    log.info("  Mode      : %s", "DRY-RUN" if args.dry_run else "LIVE")
    log.info("  Base URL  : %s", BASE_URL)
    log.info("  Partner ID: %s", PARTNER_ID)
    log.info("  Shop ID   : %s", SHOP_ID)
    log.info("  Poll every: %ds", POLL_INTERVAL)
    log.info("  Auto-reply: %s", AUTO_REPLY_ENABLED)
    log.info("=" * 50)

    if not validate_config(args.dry_run):
        sys.exit(1)

    if args.refresh_token_only:
        log.info("Refreshing access token...")
        ok = refresh_access_token()
        sys.exit(0 if ok else 1)

    if args.once:
        count = poll_and_reply(dry_run=args.dry_run)
        log.info("Processed %d conversation(s). Done.", count)
        sys.exit(0)

    # Continuous loop
    log.info("Entering polling loop (Ctrl+C to stop)")
    import schedule

    schedule.every(POLL_INTERVAL).seconds.do(poll_and_reply, dry_run=args.dry_run)

    # Run once immediately
    poll_and_reply(dry_run=args.dry_run)

    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Bot stopped by user (KeyboardInterrupt)")
        sys.exit(0)


if __name__ == "__main__":
    main()
