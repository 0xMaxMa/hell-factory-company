# Binance Auto-Earn Bot

Monitors Binance Simple Earn Flexible Products and automatically rebalances to the highest APY opportunity.

## What It Does

- Lists all available Simple Earn Flexible Products sorted by APY
- Shows your current positions and earnings
- Recommends the best product for a given asset
- In live mode: redeems lower-APY positions and subscribes to the best one
- `--dry-run` flag shows what it *would* do without executing any trades

## Quick Start

```bash
cd /home/dev/projects/hell-factory-company/job_workspaces/binance-earn

# 1. Install dependencies
bash scripts/setup.sh

# 2. Configure API keys
cp config/.env.example config/.env
# Edit config/.env with your Binance API key and secret

# 3. Test (no API keys required)
python3 scripts/main.py --dry-run

# 4. List products for USDT (requires API keys)
python3 scripts/main.py --list-only --asset USDT

# 5. Dry-run rebalance for USDT
python3 scripts/main.py --dry-run --asset USDT --rebalance

# 6. Live rebalance
python3 scripts/main.py --asset USDT --rebalance
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sapi/v1/simple-earn/flexible/list` | GET | List products + APY |
| `/sapi/v1/simple-earn/flexible/position` | GET | Current holdings |
| `/sapi/v1/simple-earn/flexible/subscribe` | POST | Invest in product |
| `/sapi/v1/simple-earn/flexible/redeem` | POST | Withdraw from product |
| `/api/v3/account` | GET | Spot wallet balance |

## Rate Limits

- Product list / position: 150 weight per IP per request
- Subscribe / Redeem: 1 request per 3 seconds per account (UID limit)
- IP limit: 1200 weight per minute total

## Authentication

All `/sapi/v1/simple-earn/` endpoints require:
1. `X-MBX-APIKEY` header with your API key
2. HMAC-SHA256 signature on query params
3. `timestamp` parameter (current Unix ms)
4. API key permissions: **Enable Reading** + **Enable Spot & Margin Trading**

## File Structure

```
binance-earn/
├── job.json          # Job metadata and API documentation
├── README.md         # This file
├── RUNBOOK.md        # Operations guide
├── scripts/
│   ├── setup.sh      # Install dependencies + validate env
│   └── main.py       # Main bot logic
├── config/
│   └── .env.example  # Environment variable template
└── logs/             # Daily log files (auto-created)
```

## Security Notes

- Never commit `config/.env` to version control
- Whitelist your server IP in Binance API settings
- Use a dedicated API key with minimal permissions (no withdrawal permission needed)
- The bot only needs: Read + Spot & Margin Trading

## Python Requirements

- Python 3.8+
- `python-binance >= 1.0.19`
- `python-dotenv >= 1.0.0`
- `requests >= 2.31.0`
- `tabulate >= 0.9.0`
