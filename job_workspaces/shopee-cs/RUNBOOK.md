# RUNBOOK — Shopee CS Bot

Operations guide for running, monitoring, and troubleshooting the Shopee CS Bot.

---

## 1. Initial Setup

### Prerequisites
- Python 3.8+
- Shopee developer account with app approved for `sellerchat` scope
- Shop authorized via OAuth

### Steps
```bash
# Install dependencies
bash /home/dev/projects/hell-factory-company/job_workspaces/shopee-cs/scripts/setup.sh

# Configure environment
cp /home/dev/projects/hell-factory-company/job_workspaces/shopee-cs/config/.env.example \
   /home/dev/projects/hell-factory-company/job_workspaces/shopee-cs/config/.env

# Edit credentials
nano /home/dev/projects/hell-factory-company/job_workspaces/shopee-cs/config/.env
```

---

## 2. Running the Bot

### Dry Run (no messages sent)
```bash
python3 scripts/main.py --dry-run
```
Use this to validate credentials and see what replies would be sent.

### Production Run
```bash
python3 scripts/main.py
```

### Run with custom poll interval
```bash
POLL_INTERVAL_SECONDS=30 python3 scripts/main.py
```

### Run in background with nohup
```bash
nohup python3 scripts/main.py >> logs/bot.log 2>&1 &
echo $! > logs/bot.pid
echo "Bot PID: $(cat logs/bot.pid)"
```

### Stop background bot
```bash
kill $(cat logs/bot.pid)
```

---

## 3. Monitoring

### View live logs
```bash
tail -f logs/bot.log
```

### Check for errors
```bash
grep -i "error\|exception\|failed" logs/bot.log | tail -50
```

### Check reply activity
```bash
grep -i "sent reply\|dry-run reply" logs/bot.log | tail -20
```

---

## 4. Token Refresh

Access tokens expire every **4 hours**. The bot auto-refreshes, but if it fails:

```bash
# Manually trigger token refresh test
python3 scripts/main.py --refresh-token-only
```

If refresh token itself expires (90 days), re-authorize the shop:
1. Generate new auth URL in developer portal
2. Seller completes OAuth flow
3. Update `SHOPEE_ACCESS_TOKEN` and `SHOPEE_REFRESH_TOKEN` in `.env`

---

## 5. Customizing Reply Templates

Edit the `REPLY_TEMPLATES` dict in `scripts/main.py`:

```python
REPLY_TEMPLATES = {
    "pricing": "ขอบคุณที่สอบถามนะคะ ...",
    "delivery": "สวัสดีค่ะ คำสั่งซื้อของคุณ ...",
    "return":   "ขอโทษที่เกิดปัญหานะคะ ...",
    "other":    "สวัสดีค่ะ ขอบคุณที่ติดต่อเข้ามา ...",
}
```

---

## 6. Troubleshooting

### Error: `401 Unauthorized`
- Check `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` values
- Verify signature generation (timestamp must be within 5 min of server time)

### Error: `403 Forbidden` on sellerchat endpoints
- Your app may not have `sellerchat` permission approved
- Submit approval request on Shopee Open Platform developer portal

### Error: `token expired`
- `access_token` expired → bot should auto-refresh, check logs
- If refresh fails: manually update token in `.env`

### No messages being polled
- Verify `SHOPEE_SHOP_ID` is correct
- Confirm the shop has unread messages in Shopee Chat
- Try `--dry-run` with `SHOPEE_TEST_MODE=true` to use sandbox

### Bot replies too fast / gets rate-limited
- Increase `POLL_INTERVAL_SECONDS` in `.env` (recommended: 60+)
- Shopee rate limits: ~100 req/min per shop

---

## 7. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `SHOPEE_PARTNER_ID` | Yes | From Shopee developer portal |
| `SHOPEE_PARTNER_KEY` | Yes | App secret key for signature |
| `SHOPEE_SHOP_ID` | Yes | Seller shop ID |
| `SHOPEE_ACCESS_TOKEN` | Yes | OAuth access token (refresh every 4h) |
| `SHOPEE_REFRESH_TOKEN` | Yes | OAuth refresh token (valid 90 days) |
| `SHOPEE_TEST_MODE` | No | `true` = use sandbox URL |
| `POLL_INTERVAL_SECONDS` | No | Default: `60` |
| `AUTO_REPLY_ENABLED` | No | Default: `true` — set `false` to log only |
| `LOG_LEVEL` | No | `DEBUG`, `INFO`, `WARNING` — default: `INFO` |

---

## 8. Scheduled Run via Cron

```cron
# Run bot every minute as health check (bot itself loops internally)
* * * * * cd /home/dev/projects/hell-factory-company/job_workspaces/shopee-cs && python3 scripts/main.py --once >> logs/cron.log 2>&1
```

Or use systemd service for persistent operation.

---

## 9. Quick Diagnostics Checklist

- [ ] `.env` file exists and has all required vars
- [ ] `python3 --version` >= 3.8
- [ ] `pip show requests python-dotenv schedule` — all installed
- [ ] Shopee developer portal: app status = Approved
- [ ] `access_token` not expired (check `logs/bot.log` for refresh activity)
- [ ] `SHOPEE_SHOP_ID` matches the authorized shop
