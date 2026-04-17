---
name: job-research
description: "Research a new job opportunity — สร้าง job_workspace พร้อมคู่มือ, scripts, และทุกอย่างที่ต้องใช้ทำงาน"
user-invocable: true
---

# /job_research — Research & Build a Job Workspace

## Usage
```
/job_research <job-name> "<research prompt>"
```

## What You Must Do

When the boss sends `/job_research`, follow these steps in order and report progress at each step.

---

### Step 1: Parse & Validate

- Extract `<job-name>` (must be lowercase, hyphens only) and `<prompt>` from args
- If job-name already exists at `/home/dev/projects/hell-factory-company/job_workspaces/<job-name>/` → ask the boss: overwrite or rename?
- If args are incomplete → tell the boss how to use the skill
- Report: "📂 สร้าง workspace แล้ว กำลัง research..."

---

### Step 2: Create Workspace

Create this directory structure under `/home/dev/projects/hell-factory-company/job_workspaces/<job-name>/`:

```
<job-name>/
├── job.json
├── README.md
├── RUNBOOK.md
├── scripts/
│   ├── setup.sh
│   └── main.py   (or main.sh — whatever fits the job)
├── config/
│   └── .env.example
└── logs/
    └── .gitkeep
```

Write `job.json` immediately with `status: "draft"`:

```json
{
  "name": "<job-name>",
  "description": "<fill after research>",
  "category": "<defi|content|freelance|data|automation|social|education>",
  "status": "draft",
  "created_at": "<ISO8601 now>",
  "updated_at": "<ISO8601 now>",
  "estimated_earnings": "TBD",
  "risk_level": "low",
  "requires": {
    "wallet": false,
    "initial_capital": "$0",
    "apis": [],
    "packages": []
  },
  "tags": [],
  "run_count": 0,
  "total_earnings": "0",
  "last_run": null
}
```

---

### Step 3: Research

Use WebSearch and WebFetch to research the prompt thoroughly:

- Find relevant APIs, tools, and platforms
- Study pricing, requirements, and limitations
- Find existing solutions or libraries
- Understand the revenue model
- Identify risks and common failure points

Do at least 3–5 web searches. Extract concrete technical details.

---

### Step 4: Build Deliverables

Write all files based on research findings. **Every file must be complete and functional — no stubs or placeholders.**

**README.md** must explain:
- What this job is and how it earns money
- Revenue model (how much, how often)
- Target platforms / markets
- Prerequisites (accounts, APIs, capital)
- Risks & limitations

**RUNBOOK.md** must be clear enough for an agent to follow without asking questions:
- Step-by-step execution instructions
- Which script to run at each step
- Expected output at each step
- Error handling table: Error → Action
- Budget limits (if any)
- Success criteria (what does "done" look like)

**scripts/setup.sh** must:
- Have `#!/bin/bash` shebang and be executable (`chmod +x`)
- Install all required packages/dependencies
- Create any necessary directories
- Validate environment variables
- Print clear success/failure messages

**scripts/main.py** (or main.sh) must:
- Have proper shebang
- Load env vars from `.env` if it exists
- Implement the core job logic (real, working code — not a skeleton)
- Have a `--dry-run` flag that simulates without making real API calls
- Print progress and results clearly
- Handle errors gracefully

**config/.env.example** must list every required and optional env var:
```
# Required
API_KEY=your_api_key_here
SECRET=your_secret_here

# Optional
DEBUG=false
DRY_RUN=false
```

Update `job.json` with the real description, category, estimated_earnings, risk_level, apis, packages, and tags discovered during research.

---

### Step 5: Test POC

Run the scripts to verify they actually work:

1. Run `bash scripts/setup.sh` — must exit 0
2. Run `python scripts/main.py --dry-run` (or equivalent) — must exit without crash
3. If any test fails: fix the script and retry. Do NOT skip.
4. If the job requires credentials that aren't available (third-party APIs), test what you can and document what can't be tested without credentials.

---

### Step 6: Report to Boss

Send a Telegram reply summarising:
- Research findings (key insights, 3–5 bullet points)
- Files created (list)
- POC test result (passed / partial / failed with reason)
- Status: `draft` (needs review) or `ready` (fully tested)
- If not ready → what's still needed

If everything looks good, update `status` in `job.json` to `"ready"`.

---

## Iterate Rules

The boss may send follow-up messages to refine the job. When they do:

- Update the relevant files immediately
- Always update `updated_at` in `job.json`
- Report what changed
- If the boss says the job is ready to deploy → set `status: "ready"` in `job.json`

---

## Hard Rules

- Every script must be **executable and actually run** — not just a placeholder
- RUNBOOK.md must be clear enough for an agent to follow without asking questions
- API keys → always `.env.example`, never hardcoded
- If a job requires spending money → estimate cost in `job.json`
- Never leave a workspace half-built — finish everything before reporting
