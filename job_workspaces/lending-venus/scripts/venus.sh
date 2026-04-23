#!/usr/bin/env bash
# Venus Protocol CLI — powered by Foundry cast
# Usage:
#   ./venus.sh list
#   ./venus.sh deposit <TOKEN> <AMOUNT>            (real tx)
#   ./venus.sh deposit <TOKEN> <AMOUNT> --dry-run  (simulate only)
#   ./venus.sh withdraw <TOKEN> <AMOUNT>           (real tx)
#   ./venus.sh withdraw <TOKEN> <AMOUNT> --dry-run (simulate only)
#   ./venus.sh balance [WALLET]                    (check vToken balances)

set -euo pipefail

# Load agent wallet — WALLET_PRIVATE_KEY exported here, no manual config needed
AGENT_ENV="$HOME/.claude-gateway/agents/indian-programmer/.env"
if [[ -f "$AGENT_ENV" ]]; then
  set -a; source "$AGENT_ENV"; set +a
fi

RPC_URL="${RPC_URL:-https://bsc-dataseed2.defibit.io}"
PRIVATE_KEY="${WALLET_PRIVATE_KEY:-${PRIVATE_KEY:-}}"

CAST="$HOME/.foundry/bin/cast"

# ─── Venus vToken addresses on BSC Mainnet (verified from Comptroller) ────────
declare -A VTOKEN=(
  [USDT]="0xfD5840Cd36d94D7229439859C0112a4185BC0255"
  [USDC]="0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8"
  [BNB]="0xA07c5b74C9B40447a954e1466938b865b6BBea36"
  [ETH]="0xf508fCD89b8bd15579dc79A6827cB4686A3592c8"
  [BTC]="0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847B"
  [BUSD]="0x95c78222B3D6e262426483D42CfA53685A67Ab9D"
  [DAI]="0x334b3eCB4DCa3593BCCC3c7EBD1A1C1d1780FBF1"
  [XVS]="0x151B1e2635A717bcDc836ECd6FbB62B674FE3E1D"
  [CAKE]="0x86aC3974e2BD0d60825230fa6F355fF11409df5c"
  [ADA]="0x9A0AF7FDb2065Ce470D72664DE73cAE409dA28Ec"
  [DOGE]="0xec3422Ef92B2fb59e84c8B02Ba73F1fE84Ed8D71"
  [DOT]="0x1610bc33319e9398de5f57B33a5b184c806aD217"
  [LTC]="0x57A5297F2cB2c0AaC9D554660acd6D385Ab50c6B"
  [FIL]="0xf91d58b5aE142DAcC749f58A49FCBac340Cb0343"
  [SXP]="0x2fF3d0F6990a40261c66E1ff2017aCBc282EB6d0"
  [TRX]="0x61eDcFe8Dd6bA3c891CB9bEc2dc7657B3B422E93"
)

# Underlying token addresses (verified on-chain)
declare -A UNDERLYING=(
  [USDT]="0x55d398326f99059fF775485246999027B3197955"
  [USDC]="0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
  [ETH]="0x2170Ed0880ac9A755fd29B2688956BD959F933F8"
  [BTC]="0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"
  [BUSD]="0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
  [DAI]="0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"
  [XVS]="0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63"
  [ADA]="0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47"
  [DOGE]="0xbA2aE424d960c26247Dd6c32edC70B295c744C43"
  [MATIC]="0xCC42724C6683B7E57334c4E856f4c9965ED682bD"
  [CAKE]="0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
  [DOT]="0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402"
  [LTC]="0x4338665CBB7B2485A8855A139b75D5e34AB0DB94"
  [FIL]="0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153"
  [LINK]="0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD"
  [SXP]="0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A"
  [TRX]="0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B"
)

# Decimals for underlying tokens
declare -A DECIMALS=(
  [USDT]=18  [USDC]=18  [BNB]=18  [ETH]=18  [BTC]=18
  [BUSD]=18  [DAI]=18   [XVS]=18  [ADA]=18  [DOGE]=8
  [MATIC]=18 [CAKE]=18  [DOT]=18  [LTC]=18  [FIL]=18
  [LINK]=18  [SXP]=18   [TRX]=6
)

# ─── Helpers ─────────────────────────────────────────────────────────────────
require_cast() {
  if [[ ! -x "$CAST" ]]; then
    echo "ERROR: cast not found at $CAST — run 'foundryup' first" >&2
    exit 1
  fi
}

require_key() {
  if [[ -z "$PRIVATE_KEY" ]]; then
    echo "ERROR: WALLET_PRIVATE_KEY not set — agent wallet not loaded" >&2
    exit 1
  fi
}

get_wallet_address() {
  "$CAST" wallet address --private-key "$PRIVATE_KEY" 2>/dev/null
}

to_wei() {
  local amount="$1" decimals="$2"
  python3 -c "print(int(float('$amount') * 10**$decimals))"
}

from_wei() {
  local wei="$1" decimals="$2"
  python3 -c "v=int('$wei',16) if '$wei'.startswith('0x') else int('$wei'); print(f'{v/10**$decimals:.6f}')"
}

# ─── list command ─────────────────────────────────────────────────────────────
cmd_list() {
  require_cast
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Venus Protocol — BNB Chain — Live Market Data"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "%-8s %-20s %-12s %-12s\n" "TOKEN" "vTOKEN ADDR" "SUPPLY APY%" "BORROW APY%"
  echo "────────────────────────────────────────────────"

  for token in USDT USDC ETH BTC BUSD DAI BNB CAKE; do
    vaddr="${VTOKEN[$token]:-}"
    [[ -z "$vaddr" ]] && continue

    supply_raw=$("$CAST" call "$vaddr" "supplyRatePerBlock()(uint256)" \
      --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    borrow_raw=$("$CAST" call "$vaddr" "borrowRatePerBlock()(uint256)" \
      --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

    supply_num=$(echo "$supply_raw" | awk '{print $1}')
    borrow_num=$(echo "$borrow_raw" | awk '{print $1}')

    supply_apy=$(python3 -c "
r=int('$supply_num') if '$supply_num' else 0
bpd=28800; apy=((r*bpd/1e18+1)**365-1)*100
print(f'{apy:.4f}')
" 2>/dev/null || echo "N/A")
    borrow_apy=$(python3 -c "
r=int('$borrow_num') if '$borrow_num' else 0
bpd=28800; apy=((r*bpd/1e18+1)**365-1)*100
print(f'{apy:.4f}')
" 2>/dev/null || echo "N/A")

    printf "%-8s %-20s %-12s %-12s\n" "$token" "${vaddr:0:18}…" "$supply_apy" "$borrow_apy"
  done
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── deposit command ──────────────────────────────────────────────────────────
cmd_deposit() {
  local token="$1" amount="$2" dry_run="${3:-false}"
  require_cast

  local vaddr="${VTOKEN[$token]:-}"
  local uaddr="${UNDERLYING[$token]:-}"
  local dec="${DECIMALS[$token]:-18}"

  if [[ -z "$vaddr" ]]; then
    echo "ERROR: Token '$token' not supported. Supported: ${!VTOKEN[*]}" >&2
    exit 1
  fi

  local wei
  wei=$(to_wei "$amount" "$dec")

  if [[ "$dry_run" == "true" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  [DRY-RUN] DEPOSIT SIMULATION"
    echo "  Token : $token | Amount: $amount | Wei: $wei"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [[ "$token" == "BNB" ]]; then
      echo "  cast call vBNB mint() --value $wei"
      "$CAST" call "$vaddr" "mint()" --value "$wei" --rpc-url "$RPC_URL" 2>&1 || true
    else
      echo "  cast call vToken mint($wei)"
      "$CAST" call "$vaddr" "mint(uint256)(uint256)" "$wei" --rpc-url "$RPC_URL" 2>&1 || true
    fi
    echo "[DRY-RUN] No transaction broadcast."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return
  fi

  # Real transaction
  require_key
  local wallet
  wallet=$(get_wallet_address)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  DEPOSIT — $token $amount"
  echo "  Wallet : $wallet"
  echo "  vToken : $vaddr"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ "$token" == "BNB" ]]; then
    echo "Sending BNB deposit to vBNB..."
    "$CAST" send "$vaddr" "mint()" \
      --value "$wei" \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY"
    echo "✓ BNB deposit sent!"
  else
    echo "Step 1/2: Approving $token spending..."
    "$CAST" send "$uaddr" \
      "approve(address,uint256)" \
      "$vaddr" "$wei" \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY"
    echo "✓ Approve done."
    echo "Step 2/2: Depositing $amount $token to Venus..."
    "$CAST" send "$vaddr" \
      "mint(uint256)" \
      "$wei" \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY"
    echo "✓ Deposit done!"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── withdraw command ─────────────────────────────────────────────────────────
cmd_withdraw() {
  local token="$1" amount="$2" dry_run="${3:-false}"
  require_cast

  local vaddr="${VTOKEN[$token]:-}"
  local dec="${DECIMALS[$token]:-18}"

  if [[ -z "$vaddr" ]]; then
    echo "ERROR: Token '$token' not supported. Supported: ${!VTOKEN[*]}" >&2
    exit 1
  fi

  local wei
  wei=$(to_wei "$amount" "$dec")

  if [[ "$dry_run" == "true" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  [DRY-RUN] WITHDRAW SIMULATION"
    echo "  Token : $token | Amount: $amount | Wei: $wei"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  cast call vToken redeemUnderlying($wei)"
    "$CAST" call "$vaddr" \
      "redeemUnderlying(uint256)(uint256)" \
      "$wei" \
      --rpc-url "$RPC_URL" \
      2>&1 || true
    echo "[DRY-RUN] No transaction broadcast."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return
  fi

  # Real transaction
  require_key
  local wallet
  wallet=$(get_wallet_address)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  WITHDRAW — $token $amount"
  echo "  Wallet : $wallet"
  echo "  vToken : $vaddr"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Sending withdraw (redeemUnderlying) tx..."
  "$CAST" send "$vaddr" \
    "redeemUnderlying(uint256)" \
    "$wei" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY"
  echo "✓ Withdraw done!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── balance command ──────────────────────────────────────────────────────────
cmd_balance() {
  local wallet="${1:-}"
  require_cast

  if [[ -z "$wallet" ]] && [[ -n "$PRIVATE_KEY" ]]; then
    wallet=$(get_wallet_address)
  fi

  if [[ -z "$wallet" ]]; then
    echo "ERROR: provide wallet address or set PRIVATE_KEY" >&2
    exit 1
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Venus balances for: $wallet"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "%-8s %s\n" "TOKEN" "vToken BALANCE"
  echo "────────────────────────────────────────────────"
  for token in USDT USDC ETH BTC BUSD BNB; do
    vaddr="${VTOKEN[$token]:-}"
    [[ -z "$vaddr" ]] && continue
    vbal=$("$CAST" call "$vaddr" "balanceOf(address)(uint256)" "$wallet" \
      --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
    vbal_fmt=$(from_wei "$vbal" 8)   # vTokens always 8 decimals
    printf "%-8s %s vTokens\n" "$token" "$vbal_fmt"
  done
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── main ─────────────────────────────────────────────────────────────────────
CMD="${1:-help}"
DRY_RUN=false

ARGS=()
for arg in "${@:2}"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  else
    ARGS+=("$arg")
  fi
done

case "$CMD" in
  list)
    cmd_list
    ;;
  deposit)
    [[ ${#ARGS[@]} -lt 2 ]] && { echo "Usage: $0 deposit <TOKEN> <AMOUNT> [--dry-run]"; exit 1; }
    cmd_deposit "${ARGS[0]}" "${ARGS[1]}" "$DRY_RUN"
    ;;
  withdraw)
    [[ ${#ARGS[@]} -lt 2 ]] && { echo "Usage: $0 withdraw <TOKEN> <AMOUNT> [--dry-run]"; exit 1; }
    cmd_withdraw "${ARGS[0]}" "${ARGS[1]}" "$DRY_RUN"
    ;;
  balance)
    cmd_balance "${ARGS[0]:-}"
    ;;
  *)
    echo "Venus Protocol CLI — Foundry cast powered"
    echo ""
    echo "Usage:"
    echo "  ./venus.sh list                               — show APY for all markets"
    echo "  ./venus.sh deposit <TOKEN> <AMOUNT>           — deposit real tx (approve + mint)"
    echo "  ./venus.sh deposit <TOKEN> <AMOUNT> --dry-run — simulate only"
    echo "  ./venus.sh withdraw <TOKEN> <AMOUNT>          — withdraw real tx (redeemUnderlying)"
    echo "  ./venus.sh withdraw <TOKEN> <AMOUNT> --dry-run — simulate only"
    echo "  ./venus.sh balance [WALLET]                   — check Venus vToken balances"
    echo ""
    echo "Supported tokens: ${!VTOKEN[*]}"
    ;;
esac
