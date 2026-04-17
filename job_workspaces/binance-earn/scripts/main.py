#!/usr/bin/env python3
"""
Binance Auto-Earn Bot
=====================
Monitors Binance Simple Earn Flexible Products and automatically
subscribes/rebalances to the highest APY opportunity.

Endpoints used:
  GET  /sapi/v1/simple-earn/flexible/list         — list products + APY
  GET  /sapi/v1/simple-earn/flexible/position     — current holdings
  POST /sapi/v1/simple-earn/flexible/subscribe    — subscribe (invest)
  POST /sapi/v1/simple-earn/flexible/redeem       — redeem (withdraw)
  GET  /api/v3/account                            — spot wallet balance

Usage:
  python3 main.py --dry-run                     # Show plan, do nothing
  python3 main.py --list-only                   # List products only
  python3 main.py --asset USDT                  # Rebalance USDT earn
  python3 main.py --asset USDT --amount 100     # Invest specific amount
  python3 main.py --asset USDT --rebalance      # Redeem old + subscribe best
"""

import argparse
import hashlib
import hmac
import json
import logging
import os
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Load .env before anything else ────────────────────────────────────────────
try:
    from dotenv import load_dotenv

    # Walk up from script dir to find config/.env
    _script_dir = Path(__file__).resolve().parent
    _project_dir = _script_dir.parent
    _env_file = _project_dir / "config" / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
        print(f"[config] Loaded .env from {_env_file}")
    else:
        load_dotenv()  # Try CWD / standard locations
except ImportError:
    print("[warn] python-dotenv not installed. Reading env vars directly.")

try:
    import requests
except ImportError:
    print("[error] 'requests' not installed. Run: pip install requests")
    sys.exit(1)

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

# ── Logging setup ─────────────────────────────────────────────────────────────
_log_dir = Path(__file__).resolve().parent.parent / "logs"
_log_dir.mkdir(exist_ok=True)
_log_file = _log_dir / f"earn_bot_{datetime.now().strftime('%Y%m%d')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(_log_file, encoding="utf-8"),
    ],
)
log = logging.getLogger("earn-bot")


# ── Constants ─────────────────────────────────────────────────────────────────
BASE_URL = "https://api.binance.com"
RECV_WINDOW = 5000  # ms
MIN_REBALANCE_APY_DIFF = 0.005  # 0.5 percentage point minimum gain to rebalance

# ── Binance REST client ────────────────────────────────────────────────────────

class BinanceClient:
    """Minimal Binance REST client with HMAC-SHA256 signing."""

    def __init__(self, api_key: str, secret_key: str, dry_run: bool = False):
        self.api_key = api_key
        self.secret_key = secret_key
        self.dry_run = dry_run
        self.session = requests.Session()
        self.session.headers.update({
            "X-MBX-APIKEY": self.api_key,
            "Content-Type": "application/x-www-form-urlencoded",
        })

    def _sign(self, params: dict) -> dict:
        """Add timestamp and HMAC-SHA256 signature to params."""
        params["timestamp"] = int(time.time() * 1000)
        params["recvWindow"] = RECV_WINDOW
        query = urllib.parse.urlencode(params)
        sig = hmac.new(
            self.secret_key.encode("utf-8"),
            query.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        params["signature"] = sig
        return params

    def _get(self, path: str, params: Optional[dict] = None, signed: bool = True) -> dict:
        params = params or {}
        if signed:
            params = self._sign(params)
        url = BASE_URL + path
        resp = self.session.get(url, params=params, timeout=10)
        return self._handle(resp)

    def _post(self, path: str, params: Optional[dict] = None, signed: bool = True) -> dict:
        params = params or {}
        if signed:
            params = self._sign(params)
        url = BASE_URL + path
        resp = self.session.post(url, data=params, timeout=10)
        return self._handle(resp)

    @staticmethod
    def _handle(resp: requests.Response) -> dict:
        try:
            data = resp.json()
        except ValueError:
            resp.raise_for_status()
            return {}
        if resp.status_code != 200:
            code = data.get("code", resp.status_code)
            msg = data.get("msg", resp.text)
            raise BinanceAPIError(code, msg)
        return data

    # ── Public API methods ────────────────────────────────────────────────────

    def get_flexible_product_list(self, asset: Optional[str] = None, size: int = 100) -> list:
        """GET /sapi/v1/simple-earn/flexible/list — all available products."""
        params: dict = {"size": size, "current": 1}
        if asset:
            params["asset"] = asset.upper()

        all_rows = []
        while True:
            data = self._get("/sapi/v1/simple-earn/flexible/list", params)
            rows = data.get("rows", [])
            all_rows.extend(rows)
            if len(all_rows) >= data.get("total", 0) or not rows:
                break
            params["current"] += 1
            time.sleep(0.5)  # be polite

        return all_rows

    def get_flexible_position(self, asset: Optional[str] = None) -> list:
        """GET /sapi/v1/simple-earn/flexible/position — current holdings."""
        params: dict = {"size": 100, "current": 1}
        if asset:
            params["asset"] = asset.upper()

        all_rows = []
        while True:
            data = self._get("/sapi/v1/simple-earn/flexible/position", params)
            rows = data.get("rows", [])
            all_rows.extend(rows)
            if len(all_rows) >= data.get("total", 0) or not rows:
                break
            params["current"] += 1
            time.sleep(0.5)

        return all_rows

    def get_spot_balance(self, asset: str) -> float:
        """GET /api/v3/account — free balance for a specific asset."""
        data = self._get("/api/v3/account")
        for bal in data.get("balances", []):
            if bal["asset"] == asset.upper():
                return float(bal["free"])
        return 0.0

    def subscribe_flexible(self, product_id: str, amount: float, auto_subscribe: bool = True) -> dict:
        """POST /sapi/v1/simple-earn/flexible/subscribe"""
        if self.dry_run:
            log.info(f"[DRY-RUN] Would subscribe: productId={product_id}, amount={amount}")
            return {"purchaseId": "DRY_RUN_ID", "success": True}
        params = {
            "productId": product_id,
            "amount": str(amount),
            "autoSubscribe": "true" if auto_subscribe else "false",
        }
        return self._post("/sapi/v1/simple-earn/flexible/subscribe", params)

    def redeem_flexible(self, product_id: str, redeem_all: bool = True, amount: Optional[float] = None) -> dict:
        """POST /sapi/v1/simple-earn/flexible/redeem"""
        if self.dry_run:
            log.info(f"[DRY-RUN] Would redeem: productId={product_id}, redeemAll={redeem_all}, amount={amount}")
            return {"redeemId": "DRY_RUN_REDEEM_ID", "success": True}
        params: dict = {"productId": product_id}
        if redeem_all:
            params["redeemAll"] = "true"
        elif amount is not None:
            params["amount"] = str(amount)
        return self._post("/sapi/v1/simple-earn/flexible/redeem", params)


class BinanceAPIError(Exception):
    def __init__(self, code, msg):
        self.code = code
        self.msg = msg
        super().__init__(f"Binance API error {code}: {msg}")


# ── Display helpers ────────────────────────────────────────────────────────────

def _fmt_apy(value) -> str:
    try:
        return f"{float(value) * 100:.4f}%"
    except (TypeError, ValueError):
        return str(value)


def _fmt_amount(value) -> str:
    try:
        return f"{float(value):,.6f}"
    except (TypeError, ValueError):
        return str(value)


def display_products(products: list, title: str = "Available Simple Earn Flexible Products") -> None:
    """Print product table sorted by APY descending."""
    if not products:
        print("  (no products found)")
        return

    # Sort by APY descending
    products = sorted(
        products,
        key=lambda p: float(p.get("latestAnnualPercentageRate", 0)),
        reverse=True,
    )

    rows = []
    for p in products:
        apy = float(p.get("latestAnnualPercentageRate", 0))
        can_buy = "YES" if p.get("canPurchase") else "NO"
        can_redeem = "YES" if p.get("canRedeem") else "NO"
        rows.append([
            p.get("asset", "?"),
            p.get("productId", "?"),
            _fmt_apy(apy),
            _fmt_amount(p.get("minPurchaseAmount", "?")),
            p.get("status", "?"),
            can_buy,
            can_redeem,
        ])

    headers = ["Asset", "Product ID", "APY", "Min Amount", "Status", "Can Buy", "Can Redeem"]

    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}")
    if HAS_TABULATE:
        print(tabulate(rows, headers=headers, tablefmt="simple"))
    else:
        print("  " + "  |  ".join(headers))
        print("  " + "-" * 60)
        for row in rows:
            print("  " + "  |  ".join(str(c) for c in row))
    print()


def display_positions(positions: list) -> None:
    """Print current positions table."""
    if not positions:
        print("  (no active positions)")
        return

    rows = []
    for pos in positions:
        rows.append([
            pos.get("asset", "?"),
            pos.get("productId", "?"),
            _fmt_amount(pos.get("totalAmount", 0)),
            _fmt_apy(pos.get("latestAnnualPercentageRate", 0)),
            _fmt_amount(pos.get("dailyBonus", 0)),
            _fmt_amount(pos.get("cumulativeBonusRewards", 0)),
            "ON" if pos.get("autoSubscribeStatus") else "OFF",
        ])

    headers = ["Asset", "Product ID", "Total Held", "Current APY", "Daily Bonus", "Total Earned", "Auto"]

    print(f"\n{'=' * 70}")
    print(f"  Current Positions")
    print(f"{'=' * 70}")
    if HAS_TABULATE:
        print(tabulate(rows, headers=headers, tablefmt="simple"))
    else:
        print("  " + "  |  ".join(headers))
        print("  " + "-" * 60)
        for row in rows:
            print("  " + "  |  ".join(str(c) for c in row))
    print()


# ── Core strategy ─────────────────────────────────────────────────────────────

def find_best_product(products: list, asset: str) -> Optional[dict]:
    """Return the purchasable product with the highest APY for the given asset."""
    candidates = [
        p for p in products
        if p.get("asset", "").upper() == asset.upper()
        and p.get("canPurchase") is True
        and p.get("status") == "PURCHASING"
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda p: float(p.get("latestAnnualPercentageRate", 0)))


def rebalance_asset(client: BinanceClient, asset: str, amount: Optional[float], dry_run: bool) -> None:
    """
    Full rebalance cycle for a single asset:
      1. Get current positions
      2. Get best available product
      3. If we're already in the best product → no action
      4. Otherwise: redeem current, subscribe to best
    """
    log.info(f"Rebalancing asset: {asset}")

    products = client.get_flexible_product_list(asset=asset)
    positions = client.get_flexible_position(asset=asset)

    best = find_best_product(products, asset)
    if not best:
        log.warning(f"  No purchasable {asset} products found. Skipping.")
        return

    best_apy = float(best.get("latestAnnualPercentageRate", 0))
    best_id = best["productId"]
    log.info(f"  Best product: {best_id} @ {_fmt_apy(best_apy)} APY")

    # Check current position
    current_pos = next((p for p in positions if p.get("productId") == best_id), None)
    if current_pos:
        current_apy = float(current_pos.get("latestAnnualPercentageRate", 0))
        if abs(best_apy - current_apy) < MIN_REBALANCE_APY_DIFF:
            log.info(f"  Already in best product ({best_id}). APY diff too small to rebalance.")
            return

    # Redeem all current positions for this asset (except if already in best)
    for pos in positions:
        pos_id = pos.get("productId")
        pos_amount = float(pos.get("totalAmount", 0))
        if pos_id == best_id:
            continue  # already in target, leave it
        if pos_amount <= 0:
            continue

        log.info(f"  Redeeming {_fmt_amount(pos_amount)} {asset} from {pos_id}")
        try:
            result = client.redeem_flexible(pos_id, redeem_all=True)
            log.info(f"  Redeem result: {result}")
        except BinanceAPIError as e:
            log.error(f"  Redeem failed: {e}")
            return

        if not dry_run:
            log.info("  Waiting 5s for redemption to settle...")
            time.sleep(5)

    # Determine amount to subscribe
    if amount is None:
        # Use full available spot balance
        spot_balance = client.get_spot_balance(asset)
        if spot_balance <= 0:
            log.warning(f"  No {asset} available in spot wallet.")
            return
        amount = spot_balance
        log.info(f"  Using full spot balance: {_fmt_amount(amount)} {asset}")

    min_purchase = float(best.get("minPurchaseAmount", 0))
    if amount < min_purchase:
        log.warning(f"  Amount {amount} < minimum {min_purchase}. Cannot subscribe.")
        return

    log.info(f"  Subscribing {_fmt_amount(amount)} {asset} to {best_id} @ {_fmt_apy(best_apy)} APY")
    try:
        result = client.subscribe_flexible(best_id, amount, auto_subscribe=True)
        log.info(f"  Subscribe result: {result}")
    except BinanceAPIError as e:
        log.error(f"  Subscribe failed: {e}")


# ── Main ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Binance Auto-Earn Bot — monitors and rebalances Simple Earn Flexible Products",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Show all products sorted by APY (no API keys needed for product list if public,
  # but Binance requires auth for /sapi endpoints — use --dry-run with placeholder keys)
  python3 main.py --dry-run --list-only

  # Dry-run: show current positions and plan (needs real API keys)
  python3 main.py --dry-run

  # Dry-run for specific asset
  python3 main.py --dry-run --asset USDT

  # Live mode: rebalance USDT to highest APY product
  python3 main.py --asset USDT --rebalance

  # Live mode: invest a specific amount
  python3 main.py --asset USDT --amount 500

  # List products for multiple assets
  python3 main.py --list-only --asset BTC
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate actions without executing any trades",
    )
    parser.add_argument(
        "--list-only",
        action="store_true",
        help="Only list available products; do not check positions or subscribe",
    )
    parser.add_argument(
        "--asset",
        type=str,
        default=None,
        help="Asset symbol to operate on (e.g. USDT, BTC, ETH, BNB). "
             "If omitted, lists all available assets.",
    )
    parser.add_argument(
        "--amount",
        type=float,
        default=None,
        help="Amount to subscribe. If omitted, uses full available spot balance.",
    )
    parser.add_argument(
        "--rebalance",
        action="store_true",
        help="Redeem current position then subscribe to best APY product",
    )
    parser.add_argument(
        "--min-apy",
        type=float,
        default=0.0,
        help="Minimum APY threshold (as decimal, e.g. 0.03 = 3%%). "
             "Do not subscribe if best APY is below this.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    is_dry_run = args.dry_run

    print("")
    print("=" * 70)
    print("  Binance Auto-Earn Bot")
    print(f"  Mode: {'DRY-RUN (no trades will be executed)' if is_dry_run else 'LIVE'}")
    print(f"  Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)

    # ── Load credentials ───────────────────────────────────────────────────────
    api_key = os.environ.get("BINANCE_API_KEY", "").strip()
    secret_key = os.environ.get("BINANCE_SECRET_KEY", "").strip()

    # Detect placeholder/unset keys
    _placeholder_patterns = ("your_", "REPLACE_ME", "DRY_RUN_", "")
    _is_placeholder = lambda v: not v or any(v.startswith(p) for p in _placeholder_patterns if p)
    keys_missing = _is_placeholder(api_key) or _is_placeholder(secret_key)

    if keys_missing:
        if is_dry_run or args.list_only:
            log.warning("API keys not set or are placeholders. Using MOCK DATA.")
            api_key = "DRY_RUN_API_KEY"
            secret_key = "DRY_RUN_SECRET_KEY"
            is_dry_run = True  # force dry-run if no keys
        else:
            log.error("BINANCE_API_KEY and BINANCE_SECRET_KEY must be set in config/.env")
            log.error("Run with --dry-run to test without real API keys")
            sys.exit(1)

    client = BinanceClient(api_key=api_key, secret_key=secret_key, dry_run=is_dry_run)

    # ── In dry-run with placeholder keys: use mock data ────────────────────────
    using_mock = keys_missing

    if using_mock:
        log.info("Using MOCK DATA (no real API calls) — placeholder keys detected")
        mock_products = _mock_products()
        mock_positions = _mock_positions()
    else:
        mock_products = None
        mock_positions = None

    # ── List products ──────────────────────────────────────────────────────────
    if args.list_only:
        asset_filter = args.asset
        try:
            products = mock_products if using_mock else client.get_flexible_product_list(asset=asset_filter)
            if asset_filter:
                products = [p for p in products if p.get("asset", "").upper() == asset_filter.upper()]
            display_products(products, title=f"Simple Earn Flexible Products{' — ' + asset_filter if asset_filter else ''}")
        except BinanceAPIError as e:
            log.error(f"Failed to fetch product list: {e}")
            if is_dry_run:
                log.info("Showing mock data instead:")
                display_products(_mock_products())
        return

    # ── Show positions ─────────────────────────────────────────────────────────
    log.info("Fetching current positions...")
    try:
        positions = mock_positions if using_mock else client.get_flexible_position(asset=args.asset)
        display_positions(positions)
    except BinanceAPIError as e:
        log.error(f"Could not fetch positions: {e}")
        positions = []

    # ── Show available products ────────────────────────────────────────────────
    log.info("Fetching available products...")
    try:
        products = mock_products if using_mock else client.get_flexible_product_list(asset=args.asset)
        display_products(
            products,
            title=f"Available Flexible Products{' — ' + args.asset if args.asset else ''}",
        )
    except BinanceAPIError as e:
        log.error(f"Could not fetch products: {e}")
        products = []

    # ── Determine recommended action ───────────────────────────────────────────
    if args.asset:
        best = find_best_product(products, args.asset)
        if best:
            best_apy = float(best.get("latestAnnualPercentageRate", 0))
            print(f"\n[RECOMMENDATION] Best {args.asset} product: {best['productId']} @ {_fmt_apy(best_apy)} APY")

            if args.min_apy and best_apy < args.min_apy:
                log.warning(
                    f"Best APY {_fmt_apy(best_apy)} is below --min-apy {_fmt_apy(args.min_apy)}. "
                    f"No action taken."
                )
                return

            if is_dry_run:
                print(f"[DRY-RUN] Would subscribe {args.amount or 'full balance'} {args.asset} "
                      f"to {best['productId']} @ {_fmt_apy(best_apy)} APY")
                print(f"[DRY-RUN] autoSubscribe=True")
                if args.rebalance and positions:
                    for pos in positions:
                        if pos.get("asset", "").upper() == args.asset.upper():
                            print(f"[DRY-RUN] Would first redeem {_fmt_amount(pos.get('totalAmount', 0))} "
                                  f"{args.asset} from {pos.get('productId')}")
            else:
                # LIVE MODE
                if args.rebalance:
                    rebalance_asset(client, args.asset, args.amount, dry_run=False)
                elif args.amount:
                    log.info(f"Subscribing {args.amount} {args.asset} to {best['productId']}")
                    try:
                        result = client.subscribe_flexible(best["productId"], args.amount)
                        log.info(f"Subscribe result: {result}")
                    except BinanceAPIError as e:
                        log.error(f"Subscribe failed: {e}")
                else:
                    log.info("Use --rebalance to rebalance or --amount N to invest a specific amount.")
        else:
            log.warning(f"No purchasable {args.asset} products available right now.")
    else:
        print("\n[TIP] Use --asset USDT (or BTC/ETH/BNB) to see best product recommendation.")
        print("      Add --dry-run to simulate, or --amount 100 to invest.")

    print(f"\nLog saved to: {_log_file}")


# ── Mock data for dry-run without API keys ────────────────────────────────────

def _mock_products() -> list:
    """Realistic mock product list for dry-run testing."""
    return [
        {
            "asset": "USDT",
            "productId": "USDT001",
            "latestAnnualPercentageRate": "0.0520",
            "tierAnnualPercentageRate": {"0": "0.0520"},
            "airDropPercentageRate": "0.0000",
            "minPurchaseAmount": "0.01",
            "canPurchase": True,
            "canRedeem": True,
            "status": "PURCHASING",
        },
        {
            "asset": "USDT",
            "productId": "USDT002",
            "latestAnnualPercentageRate": "0.0380",
            "tierAnnualPercentageRate": {"0": "0.0380"},
            "airDropPercentageRate": "0.0000",
            "minPurchaseAmount": "0.01",
            "canPurchase": True,
            "canRedeem": True,
            "status": "PURCHASING",
        },
        {
            "asset": "USDC",
            "productId": "USDC001",
            "latestAnnualPercentageRate": "0.0490",
            "tierAnnualPercentageRate": {"0": "0.0490"},
            "airDropPercentageRate": "0.0000",
            "minPurchaseAmount": "0.01",
            "canPurchase": True,
            "canRedeem": True,
            "status": "PURCHASING",
        },
        {
            "asset": "BTC",
            "productId": "BTC001",
            "latestAnnualPercentageRate": "0.0120",
            "tierAnnualPercentageRate": {"0": "0.0120"},
            "airDropPercentageRate": "0.0000",
            "minPurchaseAmount": "0.00001",
            "canPurchase": True,
            "canRedeem": True,
            "status": "PURCHASING",
        },
        {
            "asset": "ETH",
            "productId": "ETH001",
            "latestAnnualPercentageRate": "0.0290",
            "tierAnnualPercentageRate": {"0": "0.0290"},
            "airDropPercentageRate": "0.0000",
            "minPurchaseAmount": "0.0001",
            "canPurchase": True,
            "canRedeem": True,
            "status": "PURCHASING",
        },
        {
            "asset": "BNB",
            "productId": "BNB001",
            "latestAnnualPercentageRate": "0.0350",
            "tierAnnualPercentageRate": {"0": "0.0350"},
            "airDropPercentageRate": "0.0020",
            "minPurchaseAmount": "0.001",
            "canPurchase": True,
            "canRedeem": True,
            "status": "PURCHASING",
        },
    ]


def _mock_positions() -> list:
    """Realistic mock positions for dry-run testing."""
    return [
        {
            "asset": "USDT",
            "productId": "USDT002",
            "totalAmount": "1500.00000000",
            "latestAnnualPercentageRate": "0.0380",
            "autoSubscribeStatus": True,
            "dailyBonus": "0.15616438",
            "cumulativeBonusRewards": "12.34567890",
            "canRedeem": True,
        },
        {
            "asset": "BNB",
            "productId": "BNB001",
            "totalAmount": "5.00000000",
            "latestAnnualPercentageRate": "0.0350",
            "autoSubscribeStatus": True,
            "dailyBonus": "0.00047945",
            "cumulativeBonusRewards": "0.05678901",
            "canRedeem": True,
        },
    ]


if __name__ == "__main__":
    main()
