# LINE Group Chat Entertainer Bot

A LINE Messaging API bot that acts as an entertainer in group chats — answering questions, playing mini-games (word games, trivia, number guessing), and chatting naturally. Supports multiple LINE groups simultaneously with per-group persona customization.

## Features

- Handles multiple LINE groups simultaneously (stateless architecture via group_id)
- Per-group persona customization (each group gets a different bot personality)
- Natural conversation with keyword-based and pattern-matching replies
- Mini-games: number guessing, trivia, word games
- Greeting on join/leave events
- `--dry-run` mode for testing without sending real replies
- .env-based configuration

## Tech Stack

- **Python 3.10+**
- **Flask 3.x** — webhook server
- **line-bot-sdk 3.23+** — official LINE SDK (v3 API)
- **python-dotenv** — environment config

## Quick Start

```bash
# 1. Install dependencies
bash scripts/setup.sh

# 2. Configure environment
cp config/.env.example config/.env
# Edit config/.env with your LINE credentials

# 3. Start server (dry-run mode — no real replies)
python3 scripts/main.py --dry-run

# 4. Start server (production)
python3 scripts/main.py
```

## LINE Developer Setup

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Create a new channel → Messaging API
3. Enable "Allow bot to join group chats" in the Messaging API tab
4. Get your **Channel Secret** and **Channel Access Token**
5. Set webhook URL to `https://yourdomain.com/webhook`
6. Enable "Use webhook" toggle

## Webhook Events Handled

| Event | Description |
|-------|-------------|
| `MessageEvent` | User sends a text message |
| `JoinEvent` | Bot is added to a group |
| `LeaveEvent` | Bot is removed from a group |
| `MemberJoinedEvent` | A member joins the group |
| `MemberLeftEvent` | A member leaves the group |
| `FollowEvent` | User adds bot as friend |

## Per-Group Persona

Edit `GROUP_PERSONAS` in `scripts/main.py`:

```python
GROUP_PERSONAS = {
    "C1234567890abcdef": {
        "name": "TukTuk",
        "style": "funny",
        "greeting": "Sawasdee krub! TukTuk yoo tee nee laew!"
    },
    "default": {
        "name": "Bot",
        "style": "friendly",
        "greeting": "Hello everyone! I'm here to entertain you!"
    }
}
```

## Freelance Platforms

- **Fiverr**: Post as "LINE Group Chat Bot Developer" — $150-$800/project
- **Upwork**: "LINE Messaging API Expert" — $25-$80/hr
- **Freelancer.com**: "LINE Official Account Bot" — $100-$500/project
- **Thai Facebook Groups**: "Freelance IT Thailand" — 3,000-30,000 THB

## Rate Limits

- Free plan: 1,000 push messages/month (unlimited reply messages)
- Paid plans: 15,000-unlimited push messages/month
- Reply messages (event-triggered) are always free

## License

MIT
