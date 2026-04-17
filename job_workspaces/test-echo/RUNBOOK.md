# RUNBOOK: test-echo

> Last updated: 2026-04-17
> Status: draft

## Prerequisites

- [ ] bash or python3 available (standard on all systems)
- [ ] No env vars required

## Execution Steps

### Step 0: Check Disk Space

```bash
df -h . | awk 'NR==2 {print "Available disk space: " $4}'
```

Minimum required: 10 MB. If less is available, free up space before continuing.

### Step 1: Setup

```bash
cd /home/dev/projects/hell-factory-company/job_workspaces/test-echo
bash scripts/setup.sh
```

Expected output:
```
[setup] test-echo environment ready.
```

### Step 2: Execute

```bash
python3 scripts/main.py
```

Expected output:
```
[2026-04-17T00:00:00] Hello World
```

### Step 3: Verify

- [ ] Output contains a valid ISO8601 timestamp
- [ ] Output contains "Hello World"
- [ ] Exit code is 0

## Error Handling

| Error | Action |
|-------|--------|
| `python3: command not found` | Install python3 (`sudo apt install python3`) |
| `Permission denied` | Run `chmod +x scripts/*.sh scripts/main.py` |

## Success Criteria

- [ ] `scripts/setup.sh` exits 0
- [ ] `scripts/main.py` prints timestamp + Hello World and exits 0

## Budget Limits

- Max spend per run: $0
- Max total: $0
