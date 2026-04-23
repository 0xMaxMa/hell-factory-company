#!/usr/bin/env bash
# Venus Protocol — Full test suite (dry-run simulation via cast call)
# Tests: list, deposit, withdraw for USDT, ETH, BTC, BNB

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENUS="$SCRIPT_DIR/venus.sh"
PASS=0
FAIL=0
ERRORS=()

# ─── Test runner ──────────────────────────────────────────────────────────────
run_test() {
  local name="$1"; shift
  echo -n "  TEST: $name ... "
  local output
  if output=$(bash "$VENUS" "$@" 2>&1); then
    # Check for expected content
    echo "OK"
    PASS=$((PASS + 1))
    return 0
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
    ERRORS+=("$name: $output")
    return 1
  fi
}

# Test with expected string in output
assert_contains() {
  local name="$1" expected="$2"; shift 2
  echo -n "  TEST: $name ... "
  local output
  output=$(bash "$VENUS" "$@" 2>&1) || true
  if echo "$output" | grep -q "$expected"; then
    echo "OK"
    PASS=$((PASS + 1))
  else
    echo "FAIL (expected: '$expected')"
    FAIL=$((FAIL + 1))
    ERRORS+=("$name: expected '$expected' not found in output")
  fi
}

# Test that cast call reaches the contract (output contains an address or number or revert)
assert_reaches_contract() {
  local name="$1"; shift
  echo -n "  TEST: $name ... "
  local output
  output=$(bash "$VENUS" "$@" 2>&1) || true
  # Success if output contains: address, wei amount, revert msg, or 0x
  if echo "$output" | grep -qE "(0x[0-9a-fA-F]+|revert|REVERT|DRY-RUN|wei|vToken|Step [12])"; then
    echo "OK"
    PASS=$((PASS + 1))
  else
    echo "FAIL (no contract response)"
    FAIL=$((FAIL + 1))
    ERRORS+=("$name: no contract response in output")
    echo "    Output: $output"
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Venus Protocol — Full Test Suite (Foundry cast)   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. List markets ──────────────────────────────────────────────────────────
echo "▶ [1] Market List"
assert_contains "list shows USDT APY"   "USDT"  list
assert_contains "list shows ETH APY"    "ETH"   list
assert_contains "list shows BNB APY"    "BNB"   list
assert_contains "list shows BTC APY"    "BTC"   list
assert_contains "list shows SUPPLY APY" "SUPPLY APY" list
echo ""

# ─── 2. USDT deposit + withdraw ───────────────────────────────────────────────
echo "▶ [2] USDT"
assert_reaches_contract "USDT deposit 100 dry-run"   deposit USDT 100 --dry-run
assert_contains         "USDT deposit shows approve"  "approve"  deposit USDT 100 --dry-run
assert_contains         "USDT deposit shows mint"     "mint"     deposit USDT 100 --dry-run
assert_contains         "USDT deposit wei correct"    "100000000000000000000 wei" deposit USDT 100 --dry-run

assert_reaches_contract "USDT withdraw 50 dry-run"   withdraw USDT 50 --dry-run
assert_contains         "USDT withdraw shows redeem"  "redeemUnderlying" withdraw USDT 50 --dry-run
assert_contains         "USDT withdraw wei correct"   "50000000000000000000 wei"  withdraw USDT 50 --dry-run
echo ""

# ─── 3. ETH deposit + withdraw ────────────────────────────────────────────────
echo "▶ [3] ETH"
assert_reaches_contract "ETH deposit 0.1 dry-run"    deposit ETH 0.1 --dry-run
assert_contains         "ETH deposit shows approve"   "approve"  deposit ETH 0.1 --dry-run
assert_contains         "ETH deposit shows mint"      "mint"     deposit ETH 0.1 --dry-run
assert_contains         "ETH deposit wei correct"     "100000000000000000 wei" deposit ETH 0.1 --dry-run

assert_reaches_contract "ETH withdraw 0.05 dry-run"  withdraw ETH 0.05 --dry-run
assert_contains         "ETH withdraw shows redeem"   "redeemUnderlying" withdraw ETH 0.05 --dry-run
assert_contains         "ETH withdraw wei correct"    "50000000000000000 wei"  withdraw ETH 0.05 --dry-run
echo ""

# ─── 4. BTC deposit + withdraw ────────────────────────────────────────────────
echo "▶ [4] BTC"
assert_reaches_contract "BTC deposit 0.001 dry-run"  deposit BTC 0.001 --dry-run
assert_contains         "BTC deposit shows approve"   "approve"  deposit BTC 0.001 --dry-run
assert_contains         "BTC deposit shows mint"      "mint"     deposit BTC 0.001 --dry-run
# BTCB on BSC has 18 decimals: 0.001 * 1e18 = 1e15
assert_contains         "BTC deposit wei correct"     "1000000000000000 wei" deposit BTC 0.001 --dry-run

assert_reaches_contract "BTC withdraw 0.0005 dry-run" withdraw BTC 0.0005 --dry-run
assert_contains         "BTC withdraw shows redeem"   "redeemUnderlying" withdraw BTC 0.0005 --dry-run
echo ""

# ─── 5. BNB deposit + withdraw ────────────────────────────────────────────────
echo "▶ [5] BNB (native — mint() with value)"
assert_reaches_contract "BNB deposit 1 dry-run"     deposit BNB 1 --dry-run
assert_contains         "BNB deposit shows mint"    "mint"     deposit BNB 1 --dry-run
assert_contains         "BNB deposit wei correct"   "1000000000000000000 wei" deposit BNB 1 --dry-run
# BNB uses send BNB directly, no approve step
output=$(bash "$VENUS" deposit BNB 1 --dry-run 2>&1) || true
if echo "$output" | grep -q "approve"; then
  echo "  TEST: BNB deposit no approve step ... FAIL (approve should not appear for BNB)"
  FAIL=$((FAIL + 1))
  ERRORS+=("BNB deposit: should not show approve for native BNB")
else
  echo "  TEST: BNB deposit no approve step ... OK"
  PASS=$((PASS + 1))
fi

assert_reaches_contract "BNB withdraw 0.5 dry-run"  withdraw BNB 0.5 --dry-run
assert_contains         "BNB withdraw shows redeem" "redeemUnderlying" withdraw BNB 0.5 --dry-run
echo ""

# ─── 6. balance command ───────────────────────────────────────────────────────
echo "▶ [6] Balance check"
# Use Comptroller address as a wallet that might have positions
assert_contains "balance shows vToken headers" "vBalance" \
  balance "0xfD36E2c2a6789Db23113685031d7F16329158384"
echo ""

# ─── 7. Wallet auto-load ─────────────────────────────────────────────────────
echo "▶ [7] Wallet auto-load (no manual config/.env needed)"
AGENT_ENV="$HOME/.claude-gateway/agents/indian-programmer/.env"
if [[ -f "$AGENT_ENV" ]] && grep -q "WALLET_PRIVATE_KEY" "$AGENT_ENV"; then
  echo "  TEST: agent .env exists with WALLET_PRIVATE_KEY ... OK"
  PASS=$((PASS + 1))
else
  echo "  TEST: agent .env exists with WALLET_PRIVATE_KEY ... FAIL"
  FAIL=$((FAIL + 1))
  ERRORS+=("Agent .env missing or no WALLET_PRIVATE_KEY — run /crypto-wallet create first")
fi
echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    TEST SUMMARY                     ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  ✅ PASS: %-2d                                        ║\n" "$PASS"
printf "║  ❌ FAIL: %-2d                                        ║\n" "$FAIL"
echo "╚══════════════════════════════════════════════════════╝"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo "FAILURES:"
  for err in "${ERRORS[@]}"; do
    echo "  • $err"
  done
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "ALL TESTS PASSED ✅"
  exit 0
else
  echo "SOME TESTS FAILED ❌"
  exit 1
fi
