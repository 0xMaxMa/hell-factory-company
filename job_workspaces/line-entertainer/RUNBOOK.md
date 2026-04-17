# RUNBOOK — LINE Group Chat Entertainer Bot

## Prerequisites

- Python 3.10+
- pip
- Public HTTPS endpoint (or ngrok for local dev)
- LINE Developers account + Messaging API channel

---

## 1. Initial Setup

```bash
# Clone / copy this workspace
cd /path/to/line-entertainer

# Run setup script (installs deps, validates env)
bash scripts/setup.sh

# Copy and fill env
cp config/.env.example config/.env
nano config/.env
```

Required env vars:
- `LINE_CHANNEL_SECRET` — from LINE Developers Console > Basic Settings
- `LINE_CHANNEL_ACCESS_TOKEN` — from LINE Developers Console > Messaging API > Issue token

---

## 2. Local Development with ngrok

```bash
# Terminal 1: start bot in dry-run
python3 scripts/main.py --dry-run --port 5000

# Terminal 2: expose via ngrok
ngrok http 5000

# Copy ngrok HTTPS URL → LINE Developers Console > Webhook URL
# e.g. https://abc123.ngrok.io/webhook
```

---

## 3. Start in Production

```bash
# Direct Flask (development)
python3 scripts/main.py --port 5000

# Production with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 "scripts.main:create_app()"

# Or use the env var approach
export PORT=5000
gunicorn -w 4 -b 0.0.0.0:$PORT "scripts.main:create_app()"
```

---

## 4. Verify Webhook Connection

In LINE Developers Console:
1. Click "Verify" next to Webhook URL
2. Should return 200 OK
3. Check logs: `tail -f logs/bot.log`

---

## 5. Deploy to Railway (Recommended Free Hosting)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login & init
railway login
railway init

# Set env vars
railway variables set LINE_CHANNEL_SECRET=xxx
railway variables set LINE_CHANNEL_ACCESS_TOKEN=xxx

# Deploy
railway up
```

Then update LINE webhook URL to Railway's public URL.

---

## 6. Monitoring & Logs

```bash
# View live logs
tail -f logs/bot.log

# Check process
ps aux | grep main.py

# Health check endpoint
curl http://localhost:5000/health
```

---

## 7. Add Bot to a Group

1. Open LINE app
2. Go to a group
3. Tap group name → Invite
4. Search for your bot by name
5. The bot will fire a `JoinEvent` and send a greeting

---

## 8. Customize Personas

Edit `GROUP_PERSONAS` dict in `scripts/main.py`:

```python
GROUP_PERSONAS = {
    "C<actual_group_id>": {
        "name": "CustomName",
        "style": "funny",  # funny | friendly | formal | tsundere
        "greeting": "Custom greeting message!"
    }
}
```

To find a group's ID, check `logs/bot.log` — it logs every group_id that sends a message.

---

## 9. Troubleshooting

| Issue | Fix |
|-------|-----|
| 403 Invalid signature | Check LINE_CHANNEL_SECRET is correct |
| Bot not responding | Verify webhook URL is HTTPS and accessible |
| Bot not in group | Enable "Allow bot to join group chats" in Developers Console |
| Rate limit errors | Upgrade LINE plan or reduce push messages |
| Import errors | Run `bash scripts/setup.sh` again |

---

## 10. LINE API Limits

| Feature | Free | Standard |
|---------|------|----------|
| Reply messages | Unlimited | Unlimited |
| Push messages | 1,000/month | 15,000-unlimited |
| Groups supported | Unlimited | Unlimited |
| Webhook events | Unlimited | Unlimited |

---

## 11. Games Available

- `!guess` — Number guessing game (1-100)
- `!trivia` — Random trivia question
- `!joke` — Random joke
- `!help` — Show command list
- `!info` — Bot info & persona name
