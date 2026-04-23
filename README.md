```
+============================================================================+
|                                                                            |
|  ██╗  ██╗███████╗██╗     ██╗                                               |
|  ██║  ██║██╔════╝██║     ██║                                               |
|  ███████║█████╗  ██║     ██║                                               |
|  ██╔══██║██╔══╝  ██║     ██║                                               |
|  ██║  ██║███████╗███████╗███████╗                                          |
|  ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝                                          |
|                                                                            |
|  ███████╗ █████╗  ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗               |
|  ██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝               |
|  █████╗  ███████║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝                |
|  ██╔══╝  ██╔══██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝                 |
|  ██║     ██║  ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║                  |
|  ╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝                  |
|                                                                            |
|  ██████╗ ██████╗ ███╗   ███╗██████╗  █████╗ ███╗  ██╗██╗   ██╗             |
|  ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗████╗ ██║╚██╗ ██╔╝            |
|  ██║     ██║   ██║██╔████╔██║██████╔╝███████║██╔██╗██║ ╚████╔╝             |
|  ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██╔══██║██║╚████║  ╚██╔╝              |
|  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ██║  ██║██║ ╚███║   ██║               |
|   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚══╝   ╚═╝               |
|                                                                            |
+============================================================================+
```

# Hell Factory Company

AI-powered autonomous business platform — deploy Claude agents to run real businesses, earn revenue through Telegram bots and DeFi, collect crypto payments on BNB Chain, and reinvest.

---

## Project Structure

```
hell-factory-company/
├── interface/               # Next.js app — dashboard, API gateway, wallet tracking
├── job_workspaces/          # Ready-to-run job agents
│   ├── teach-eng/           # English teaching Telegram bot
│   ├── lnw-xo/             # Tic-Tac-Toe game with crypto payout
│   ├── lending-venus/       # Venus Protocol DeFi (deposit/withdraw)
│   ├── test-echo/           # Minimal test job
│   └── test-paid/           # Payment flow test job
├── skills/                  # Claude Gateway skills
│   ├── job-research/        # /job-research — create new job workspaces
│   ├── job-run/             # /job-run — execute jobs with payment gate
│   └── crypto-wallet/       # /crypto-wallet — manage EVM wallet
└── planning-*.md            # Development planning docs
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Recharts |
| Backend | Next.js API Routes, TypeScript |
| AI Agent | Claude Gateway (localhost:3000) |
| Blockchain | BNB Chain, BSCScan API, Foundry `cast` |
| Bot | python-telegram-bot >= 20.0 |
| Storage | JSON files (sessions.json, payments.json, wallet_history.json) |

---

## Skills

### /job-research — Research & Create Job Workspace

Creates a complete job workspace from scratch by researching the opportunity, writing scripts, and testing.

```
/job-research <job-name> "<research prompt>"
```

**What it does:**

1. **Parse & Validate** — Extract job-name (lowercase-hyphen), check for conflicts
2. **Create Workspace** — Scaffold directory: `job.json`, `README.md`, `RUNBOOK.md`, `scripts/`, `config/`, `logs/`
3. **Research** — WebSearch 3-5 sources (APIs, pricing, revenue models, risks)
4. **Build Deliverables** — Write all files with real working code (not stubs):
   - `scripts/setup.sh` — Install dependencies, must exit 0
   - `scripts/main.py` (or `bot.py`) — Core logic with `--dry-run` flag
   - `config/.env.example` — All required env vars
   - `RUNBOOK.md` — Step-by-step guide executable by `/job-run`
5. **Test POC** — Run `setup.sh` + `main.py --dry-run` to verify
6. **Report** — Telegram summary with findings, status, and next steps

**Output**: `job.json` with `status: "draft"` (or `"ready"` if fully tested)

---

### /job-run — Execute Job with Payment Gate

Runs a job from `job_workspaces/`, starts the bot, handles payment verification, then lets the bot serve customers.

```
/job-run <job-name>
```

**What it does:**

1. **Step 1 (silent)** — Read `job.json` + `README.md`, validate `status == "ready"`
2. **Step 2 (silent)** — Kill old bot, get session ID from Hell-Factory API, write `session.json`, run `RUNBOOK.md` steps
3. **Step 3 (first output)** — Send welcome message + "type /start to begin"
4. **Step 4** — Receive `/start` from bot.py, check `initial_capital`:
   - `$0` → respond `payment_ok` JSON, start service immediately
   - `$5+` → respond `payment_request` JSON with wallet address, wait for tx hash
5. **Step 5-6** — Verify tx hash on BNB Chain via `verify_payment.sh`, record payment
6. **Step 7** — Receive `/end` when session complete, reset payment flag

**Response format** (Step 4-7): Always JSON with `type` field:

| type | When |
|---|---|
| `payment_ok` | Free service or payment verified |
| `payment_request` | Requesting crypto payment |
| `payment_failed` | TX verification failed |
| `text` | General message |
| `question` | Quiz with 4 `choices` |
| `summary` | Score summary, end of session |

---

### Setting Up Skill Symlinks

Skills source code lives in this project at `skills/`. Claude Gateway reads skills from each agent's workspace directory. To connect them, create symlinks **from** the agent workspace **to** this project:

```bash
# Target: agent workspace skills directory
cd ~/.claude-gateway/agents/<agent-id>/workspace/skills/

# Create symlinks pointing back to this project's skills:
ln -s /home/dev/projects/hell-factory-company/skills/job-research job-research
ln -s /home/dev/projects/hell-factory-company/skills/job-run job-run
ln -s /home/dev/projects/hell-factory-company/skills/crypto-wallet crypto-wallet
```

This means:
- **Source of truth**: `hell-factory-company/skills/` (edit skills here)
- **Gateway reads from**: `~/.claude-gateway/agents/<agent-id>/workspace/skills/` (symlinks)
- Gateway hot-reloads — no restart needed after creating or updating symlinks

**Example for `indian-programmer` agent:**

```
~/.claude-gateway/agents/indian-programmer/workspace/skills/
├── crypto-wallet -> /home/dev/projects/hell-factory-company/skills/crypto-wallet
├── job-research  -> /home/dev/projects/hell-factory-company/skills/job-research
└── job-run       -> /home/dev/projects/hell-factory-company/skills/job-run
```

---

## Job Workspace Architecture

Every job lives in `job_workspaces/<job-name>/` with a standard structure:

```
<job-name>/
├── job.json              # Metadata: name, status, cost, requirements
├── README.md             # What the job does, revenue model
├── RUNBOOK.md            # Step-by-step execution guide (used by /job-run)
├── scripts/
│   ├── setup.sh          # Install dependencies (must exit 0)
│   └── bot.py            # Main bot logic (or main.py/main.sh)
├── config/
│   └── .env.example      # Required environment variables
├── data/
│   └── session.json      # Current session ID + start time
└── logs/
    └── bot.log           # Live bot output
```

### job.json Schema

```json
{
  "name": "Display Name",
  "description": "What the job does",
  "category": "education|defi|automation|...",
  "status": "draft|ready",
  "estimated_earnings": "$X per unit",
  "risk_level": "low|medium|high",
  "requires": {
    "wallet": false,
    "initial_capital": "$0",
    "apis": ["telegram-bot-api"],
    "packages": ["python-telegram-bot>=20.0"]
  },
  "tags": ["telegram", "education"],
  "run_count": 0,
  "total_earnings": "0",
  "last_run": null,
  "enabled": true
}
```

`initial_capital` controls the payment gate:
- `"$0"` — Free, skip payment entirely
- `"$5"` — Require $5 USDT payment before service starts

---

## Architecture & Flow

### System Overview

```
+------------------+     +------------------+     +-------------------+
|   Telegram User  |     |  Hell Factory    |     |  Claude Gateway   |
|   (Customer)     |     |  Interface       |     |  (localhost:3000)  |
|                  |     |  (localhost:4200) |     |                   |
+--------+---------+     +--------+---------+     +--------+----------+
         |                        |                         |
         |  /start               |                         |
         +-----> bot.py -------->| POST /api/v1/chat       |
         |       (Telegram bot)  |  session_id + message   |
         |                       |                         |
         |                       |  POST /api/v1/agents/   |
         |                       |    indian-programmer/   |
         |                       |    messages             |
         |                       |------------------------>|
         |                       |                         |
         |                       |                         | (runs /job-run skill)
         |                       |                         | (checks payment)
         |                       |                         | (verifies on BNB Chain)
         |                       |                         |
         |                       |  { response: "JSON" }   |
         |                       |<------------------------|
         |                       |                         |
         |  { response: "JSON" } |                         |
         |<----- bot.py <--------|                         |
         |  (inline keyboard)    |                         |
         |                       |                         |
```

### Flow: Job Creation to Execution

```
1. /job-research teach-eng "Create English teaching bot"
   |
   v
2. Skill researches, creates workspace:
   job_workspaces/teach-eng/
   ├── job.json (status: "draft")
   ├── README.md, RUNBOOK.md
   └── scripts/bot.py (real working code)
   |
   v
3. Boss reviews, sets status: "ready"
   |
   v
4. /job-run teach-eng
   |
   v
5. Skill (silently):
   - Kills old bot process
   - Gets session ID from /api/sessions
   - Writes data/session.json
   - Runs RUNBOOK.md (setup.sh + start bot.py)
   |
   v
6. Skill outputs welcome message (first and only output)
   |
   v
7. Customer sends /start in Telegram
   |
   v
8. bot.py -> Hell Factory /api/v1/chat -> Gateway /api/v1/agents/.../messages -> /job-run skill
   |
   v
9. Payment gate:
   - $0: payment_ok -> start service
   - $5: payment_request -> wait for tx hash -> verify on BNB Chain -> payment_ok
   |
   v
10. Service runs (questions, answers, summary)
    |
    v
11. Customer done -> /end -> reset payment_flag -> ready for next customer
```

### Bot-to-Agent Communication

`bot.py` communicates with the Claude agent through the Hell Factory API:

```
bot.py                        Hell Factory API              Claude Gateway
  |                               |                              |
  |  POST /api/v1/chat            |                              |
  |  {                            |                              |
  |    session_id: "job-xxx",     |                              |
  |    message: "/start\n..."     |  POST /api/v1/agents/        |
  |  }                            |    indian-programmer/        |
  |  --------------------------->>|    messages                  |
  |                               |  --------------------------->>
  |                               |                              |
  |                               |  SSE stream (text_delta,     |
  |                               |    result)                   |
  |                               |<<---------------------------
  |  { response: "JSON..." }      |                              |
  |<<----------------------------  |                              |
  |                               |                              |
  |  Parse JSON response          |                              |
  |  Render to Telegram           |                              |
  |  (inline keyboard if quiz)    |                              |
```

**Key env vars for bot.py:**

```bash
TELEGRAM_BOT_TOKEN=<bot token>
HELL_FACTORY_URL=http://localhost:4200
HELL_FACTORY_API_KEY=hell-factory-api-key
JOB_SESSION_ID=job-teach-eng-<timestamp>
```

### Payment Verification Flow

```
Customer sends USDT to wallet address
  |
  v
Customer sends tx hash (0x...) to Telegram
  |
  v
bot.py forwards to agent via /api/v1/chat
  |
  v
Agent runs: verify_payment.sh <tx_hash>
  |
  v
Script checks via BSCScan API:
  1. TX confirmed on BNB Chain
  2. "to" address matches our wallet
  3. Valid BNB or ERC-20 transfer
  4. TX timestamp: after request, within 15 minutes
  5. TX hash never used before (replay protection)
  |
  v
VERIFIED -> POST /api/payments (record it) -> payment_ok
FAILED   -> payment_failed (ask for new tx hash)
```

---

## Interface API Routes

Base URL: `http://localhost:4200`

### Chat & Agent

| Method | Route | Description |
|---|---|---|
| POST | `/api/v1/chat` | Send message to agent, get response (used by bot.py) |
| POST | `/api/gateway/messages` | Proxy to Claude Gateway (SSE streaming) |
| GET | `/api/gateway/status` | Check gateway health |

### Config

| Method | Route | Description |
|---|---|---|
| GET | `/api/config` | Get gateway configuration |
| POST | `/api/config` | Update gateway configuration |

### Sessions

| Method | Route | Description |
|---|---|---|
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create new session |
| GET | `/api/sessions/[id]` | Get session details |
| PATCH | `/api/sessions/[id]` | Update session status |
| DELETE | `/api/sessions/[id]` | Delete session |
| POST | `/api/sessions/[id]/messages` | Send message to session (UI chat) |
| GET | `/api/sessions/[id]/gateway-sync` | Sync session with Claude Gateway |

### Jobs

| Method | Route | Description |
|---|---|---|
| GET | `/api/jobs` | List jobs (`?all=1` includes drafts) |
| GET | `/api/jobs/[name]` | Get job details |
| GET | `/api/jobs/[name]/runbook` | Get RUNBOOK.md content |
| PATCH | `/api/jobs/[name]/toggle` | Enable/disable job |

### Wallet & Payments

| Method | Route | Description |
|---|---|---|
| GET | `/api/wallet` | Current balance (BNB, USDT, Venus positions) |
| GET | `/api/wallet/address` | Get wallet address |
| GET | `/api/wallet/history` | Daily balance snapshots (for charts) |
| GET | `/api/wallet/incoming` | Incoming transaction history |
| GET | `/api/wallet/snapshot` | Save hourly balance snapshot (cron) |
| GET | `/api/wallet/transactions` | BNB transactions with job attribution |
| GET | `/api/payments` | List recorded payments |
| POST | `/api/payments` | Record new payment |
| POST | `/api/dispatch` | Launch multiple jobs in parallel |

---

## Quickstart

```bash
# 1. Start the interface
cd interface
npm install
make start     # runs on port 4200 (or: npx next dev --port 4200)

# 2. Ensure Claude Gateway is running on port 3000

# 3. Create symlinks (one-time setup)
cd ~/.claude-gateway/agents/<agent-id>/workspace/skills/
ln -s /home/dev/projects/hell-factory-company/skills/job-research job-research
ln -s /home/dev/projects/hell-factory-company/skills/job-run job-run
ln -s /home/dev/projects/hell-factory-company/skills/crypto-wallet crypto-wallet

# 4. Research a new job
#    (via Telegram or agent): /job-research my-job "description"

# 5. Run a job
#    (via Telegram or agent): /job-run my-job
```

---

## Data Storage

No database — all state persists in JSON files under `interface/`:

| File | Content |
|---|---|
| `sessions.json` | Active/completed sessions |
| `payments.json` | Recorded crypto payments |
| `wallet_history.json` | Daily wallet balance snapshots |
| `config.json` | Gateway URL, API key, agent ID |
| `chat-logs/<session-id>.json` | Message history per session |

---

## Disclaimer

This project is a **proof of concept (POC)** for educational and experimental purposes only.

- **Not production-ready** — no authentication on API routes, no rate limiting, no input sanitization beyond basic checks
- **No database** — all state stored in JSON files (no ACID guarantees, no concurrent write safety)
- **Private keys** — stored in plaintext `.env` files on disk, not in a secure vault or HSM
- **Payment verification** — relies on BSCScan API and basic on-chain checks; not battle-tested against sophisticated attacks
- **Single-process architecture** — no redundancy, no health checks, no auto-restart
- **Telegram bot tokens** — stored locally, no token rotation or revocation mechanism

**Do not deploy this to production or use with real funds without a thorough security audit.** Use at your own risk.
