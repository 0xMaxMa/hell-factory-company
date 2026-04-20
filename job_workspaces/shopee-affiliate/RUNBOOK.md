# Shopee Affiliate — RUNBOOK

## Prerequisites

1. Shopee affiliate account approved (regional portal)
2. AppID and Secret copied from affiliate dashboard → Open API section
3. `.env` file created from `config/.env.example`

---

## Step 1: Setup

```bash
bash scripts/setup.sh
```

Expected output:
```
[OK] Python 3.x found
[OK] Dependencies installed
[OK] .env file found
[OK] APP_ID set
[OK] SECRET_KEY set
Setup complete.
```

If setup fails → check Python version (requires 3.8+) and pip access.

---

## Step 2: Dry Run (test without API calls)

```bash
python scripts/main.py --dry-run
```

Expected output:
```
[DRY-RUN] Would fetch products for keyword: ...
[DRY-RUN] Would generate affiliate links for X products
[DRY-RUN] Would export to output/links.csv
Dry run complete. No API calls made.
```

---

## Step 3: Fetch Products and Generate Affiliate Links

```bash
python scripts/main.py --keyword "skincare" --limit 20
```

Expected output:
```
Fetching products for: skincare
Found 20 products
Generating affiliate links...
Exported to output/links.csv
```

Output file: `output/links.csv` with columns: product_name, product_url, affiliate_link, commission_rate, price

---

## Step 4: Promote Links

- Post affiliate links on social media, blog, YouTube descriptions, etc.
- Do NOT send via private messages or messaging apps
- Disclose affiliate relationship in posts (required by ToS)

---

## Step 5: Track Earnings

```bash
python scripts/main.py --report
```

Expected output: commission summary from API (requires valid credentials).

---

## Error Handling

| Error | Action |
|-------|--------|
| `401 Unauthorized` | Check APP_ID and SECRET_KEY in .env; re-generate credentials from dashboard |
| `429 Too Many Requests` | Reduce request frequency; script auto-retries with exponential backoff |
| `Signature mismatch` | Verify timestamp is Unix seconds (not ms); check secret key has no trailing spaces |
| `Account not approved` | Complete affiliate application at regional Shopee affiliate portal |
| `Commission rejected` | Check fraud flags; do not use personal account to test purchases |

---

## Budget Limits

- No capital required
- API usage is free (rate limit: 100 req/min)

---

## Success Criteria

- `setup.sh` exits 0
- `main.py --dry-run` exits 0 with no errors
- `main.py --keyword X` produces non-empty `output/links.csv`
- Generated links contain affiliate tracking parameters
