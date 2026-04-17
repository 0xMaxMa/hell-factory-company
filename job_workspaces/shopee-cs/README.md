# Shopee CS Bot — Automated Customer Service via Shopee Open API v2

Polls Shopee seller chat, classifies buyer messages by intent, and sends rule-based auto-replies. Built on **Shopee Open Platform API v2**.

---

## What It Does

| Message Type | Detection Keywords | Auto-Reply |
|---|---|---|
| **Pricing inquiry** | ราคา, price, ลด, discount, promo | Price/promotion template |
| **Delivery / shipping** | ส่ง, shipping, track, เมื่อไหร่, when, จัดส่ง | Order status + tracking link |
| **Return / refund** | คืน, return, refund, เสีย, broken, defect | Return policy + escalation |
| **General / other** | (catch-all) | Generic polite response |

---

## Shopee Open API v2 — Quick Reference

### Base URLs
| Environment | URL |
|---|---|
| Production | `https://partner.shopeemobile.com/api/v2` |
| Test/Sandbox | `https://partner.test-stable.shopeemobile.com/api/v2` |

### Key Chat Endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/sellerchat/get_conversation_list` | List buyer conversations |
| GET | `/sellerchat/get_message` | Get messages in a conversation |
| POST | `/sellerchat/send_message` | Send reply to buyer |
| POST | `/sellerchat/read_conversation` | Mark conversation as read |
| GET | `/order/get_order_detail` | Get order for shipping queries |

### Authentication (HMAC-SHA256)
Every request must include:
- `partner_id` — from developer account
- `timestamp` — Unix epoch (seconds)
- `sign` — HMAC-SHA256 of `{partner_id}{path}{timestamp}{access_token}{shop_id}` using `partner_key`
- `access_token` — OAuth token (valid 4 hours)
- `shop_id` — seller shop ID

### Token Lifecycle
```
1. Seller authorizes → GET /auth/token/get → access_token + refresh_token
2. Every 4h: POST /auth/access_token/get (with refresh_token) → new access_token
```

---

## Directory Structure
```
shopee-cs/
├── job.json              # Job metadata and API requirements
├── README.md             # This file
├── RUNBOOK.md            # Operations runbook
├── scripts/
│   ├── setup.sh          # Install deps + validate environment
│   └── main.py           # Main bot loop
├── config/
│   └── .env.example      # Required env vars template
└── logs/
    └── .gitkeep
```

---

## Quick Start

```bash
cd /home/dev/projects/hell-factory-company/job_workspaces/shopee-cs

# 1. Install dependencies
bash scripts/setup.sh

# 2. Configure credentials
cp config/.env.example config/.env
nano config/.env   # fill in your Shopee credentials

# 3. Test without sending any messages
python3 scripts/main.py --dry-run

# 4. Run for real
python3 scripts/main.py
```

---

## Getting Shopee API Credentials

1. Register at https://open.shopee.com/
2. Create an app → get `partner_id` and `partner_key`
3. Authorize your shop → get `access_token`, `refresh_token`, `shop_id`
4. For test/sandbox: use test credentials from the developer portal

---

## Notes & Limitations

- Shopee's chat API may require app approval for production use
- Auto-reply bots must comply with Shopee's seller policies (no spam, no misleading info)
- `access_token` expires every 4 hours — the bot auto-refreshes using `refresh_token`
- Polling interval default: 60 seconds (configurable via `POLL_INTERVAL_SECONDS`)
