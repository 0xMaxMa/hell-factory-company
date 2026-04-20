# RUNBOOK — teach-eng

## Prerequisites

- Python 3.8+
- `pip install -r requirements.txt` or run `scripts/setup.sh`
- Copy `config/.env.example` to `config/.env` and fill values

## Step-by-Step Execution

### Step 1: Setup

```bash
bash scripts/setup.sh
```

Expected output:
```
[OK] Python 3.x found
[OK] Dependencies installed
[OK] .env validated
Setup complete!
```

### Step 2: Browse Available Platforms

```bash
python scripts/main.py --mode platforms
```

Expected output: Table of platforms with rates, requirements, links

### Step 3: Generate a Lesson Plan

```bash
python scripts/main.py --mode lesson --age kids --level beginner --topic animals --duration 60
```

Arguments:
- `--age`: `kids` (5–12) or `adults`
- `--level`: `beginner`, `intermediate`, `advanced`
- `--topic`: any topic string (animals, food, jobs, travel, etc.)
- `--duration`: 25, 50, or 60 minutes

Expected output: Full lesson plan saved to `logs/lesson_<timestamp>.md`

### Step 4: Generate Activity Ideas

```bash
python scripts/main.py --mode activities --format qa --age kids --count 10
```

Arguments:
- `--format`: `qa`, `matching`, `roleplay`, `fillblank`, `storytelling`
- `--count`: number of activity items to generate

### Step 5: Dry Run (demo all modes)

```bash
python scripts/main.py --dry-run
```

Runs all modes with sample data, no API calls needed.

---

## Telegram Bot (Interactive Teaching)

### Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram → get `BOT_TOKEN`
2. Copy `config/.env.example` → `config/.env` and set `TELEGRAM_BOT_TOKEN=<your_token>`

### Bot Dry Run (no token needed)

```bash
python3 scripts/bot.py --dry-run
```

Simulates a full lesson session in terminal.

### Start the Bot

```bash
python3 scripts/bot.py
```

### Student Flow

```
Student: /start
Bot:     Hello! Who am I teaching? [Kids] [Adults]
Student: [Kids]
Bot:     What level? [Beginner] [Intermediate] [Advanced]
Student: [Beginner]
Bot:     Choose topic: [Animals] [Food] [Colors] ...
Student: [Animals]
Bot:     Question 1/8 — What is this? 🐶  [dog] [cat] [fish] [bird]
Student: [dog]
Bot:     Great job! 🌟
Bot:     Question 2/8 — ...
...
Bot:     🎊 Lesson complete! Score: 7/8 (87%) ⭐⭐⭐ Outstanding!
```

Commands:
- `/start` — begin a new lesson
- `/stop`  — end lesson at any time

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| `ModuleNotFoundError` | Missing packages | Run `bash scripts/setup.sh` again |
| `Invalid age group` | Wrong --age value | Use `kids` or `adults` only |
| `Invalid level` | Wrong --level | Use `beginner`, `intermediate`, or `advanced` |
| `Duration must be 25, 50, or 60` | Wrong duration | Use one of the accepted values |
| Bot not responding | No token set | Set `TELEGRAM_BOT_TOKEN` in `config/.env` |
| `Conflict: terminated` | Bot running twice | Kill other instance, restart |

## Budget Limits

- No API costs — lesson generation is local/template-based
- Optional: OpenAI API for AI-generated content (set `OPENAI_API_KEY` in `.env`)

## Success Criteria

- `setup.sh` exits 0
- `--dry-run` completes without crash
- Lesson plan file appears in `logs/`
- Platform table prints correctly
