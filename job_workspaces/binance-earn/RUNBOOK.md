# Binance Auto-Earn Bot — Runbook

## Prerequisites

- Python 3.8+
- Binance account with API access enabled
- API key with: **Enable Reading** + **Enable Spot & Margin Trading**
- Assets in Spot wallet to subscribe

---

## Initial Setup

```bash
# 1. Run setup script
bash /home/dev/projects/hell-factory-company/job_workspaces/binance-earn/scripts/setup.sh

# 2. Copy and fill .env
cp config/.env.example config/.env
nano config/.env  # or use any editor
# Set: BINANCE_API_KEY, BINANCE_SECRET_KEY

# 3. Verify setup
python3 scripts/main.py --dry-run
```

---

## Daily Operations

### Check current positions and best opportunities
```bash
python3 scripts/main.py --dry-run
```

### List all available products (sorted by APY)
```bash
python3 scripts/main.py --list-only
```

### List products for specific asset
```bash
python3 scripts/main.py --list-only --asset USDT
python3 scripts/main.py --list-only --asset BTC
```

### Dry-run rebalance (see what would happen)
```bash
python3 scripts/main.py --dry-run --asset USDT --rebalance
```

### Live rebalance (redeem current, subscribe to best APY)
```bash
python3 scripts/main.py --asset USDT --rebalance
```

### Invest a specific amount (no rebalance)
```bash
python3 scripts/main.py --asset USDT --amount 1000
```

### Only subscribe if APY is at least 3%
```bash
python3 scripts/main.py --asset USDT --rebalance --min-apy 0.03
```

---

## Automated Scheduling (cron)

Add to crontab to run daily at 08:00:
```
0 8 * * * cd /home/dev/projects/hell-factory-company/job_workspaces/binance-earn && python3 scripts/main.py --asset USDT --rebalance --min-apy 0.02 >> logs/cron.log 2>&1
```

---

## Troubleshooting

### Error: `Binance API error -1021: Timestamp for this request is outside of the recvWindow`
- Your system clock is out of sync
- Fix: `sudo ntpdate pool.ntp.org` or `timedatectl set-ntp true`

### Error: `Binance API error -2014: API-key format invalid`
- Check that BINANCE_API_KEY in config/.env has no extra spaces or quotes
- Verify the key is active on Binance

### Error: `Binance API error -1100: Illegal characters found in parameter`
- The amount has too many decimal places for the asset
- Reduce precision: e.g., use `100.00` not `100.123456789`

### Error: `Binance API error -3054: Product is not currently available`
- The product status changed to END/PREHEATING
- Run `--list-only` to see currently available products

### No products found for asset
- The asset may not have flexible earn products currently
- Check https://www.binance.com/en/earn/simple-earn for available products
- Try a different asset: USDT, USDC, BNB tend to always have products

### Subscribe fails with rate limit error
- Simple Earn subscribe/redeem is limited to 1 request per 3 seconds
- If running multiple assets, add `time.sleep(3)` between subscriptions

---

## Log Files

Logs are stored in `logs/earn_bot_YYYYMMDD.log`

```bash
# View today's log
tail -f logs/earn_bot_$(date +%Y%m%d).log

# View last 50 lines
tail -50 logs/earn_bot_$(date +%Y%m%d).log
```

---

## Key APY Concepts

- `latestAnnualPercentageRate`: The current APY for the product (as a decimal, e.g. 0.052 = 5.2%)
- `tierAnnualPercentageRate`: Different rates for different deposit tiers
- `airDropPercentageRate`: Bonus airdrop rewards on top of base APY
- Rewards are distributed daily and auto-compounded if `autoSubscribe=true`

---

## Common Scenarios

### Scenario 1: New user, first time investing
```bash
# Check what's available
python3 scripts/main.py --list-only --asset USDT

# Invest 500 USDT into best product (dry-run first)
python3 scripts/main.py --dry-run --asset USDT --amount 500
python3 scripts/main.py --asset USDT --amount 500
```

### Scenario 2: Rebalancing from old product to new higher APY
```bash
# Check current positions vs available
python3 scripts/main.py --dry-run --asset USDT --rebalance

# If satisfied with the plan, execute
python3 scripts/main.py --asset USDT --rebalance
```

### Scenario 3: Emergency redeem (manual)
If you need funds back in spot wallet, use Binance web interface or:
```bash
# This would redeem all USDT positions (use with care)
python3 scripts/main.py --dry-run --asset USDT --rebalance
# Then check the log to confirm redemption IDs
```
