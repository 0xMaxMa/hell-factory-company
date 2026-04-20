#!/usr/bin/env python3
"""Shopee Affiliate — fetch products and generate affiliate links."""

import argparse
import csv
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / "config" / ".env")
except ImportError:
    pass

import requests

APP_ID = os.getenv("APP_ID", "")
SECRET_KEY = os.getenv("SECRET_KEY", "")
REGION = os.getenv("SHOPEE_REGION", "my")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

ENDPOINTS = {
    "my": "https://open-api.affiliate.shopee.com.my/graphql",
    "id": "https://open-api.affiliate.shopee.co.id/graphql",
    "th": "https://open-api.affiliate.shopee.co.th/graphql",
    "sg": "https://open-api.affiliate.shopee.sg/graphql",
    "ph": "https://open-api.affiliate.shopee.com.ph/graphql",
    "vn": "https://open-api.affiliate.shopee.vn/graphql",
    "tw": "https://open-api.affiliate.shopee.com.tw/graphql",
}


def _sign(app_id: str, secret: str, timestamp: int, payload: str) -> str:
    """Generate SHA256 HMAC signature."""
    message = f"{app_id}{timestamp}{payload}{secret}"
    return hashlib.sha256(message.encode()).hexdigest()


def _headers(payload: str) -> dict:
    ts = int(time.time())
    sig = _sign(APP_ID, SECRET_KEY, ts, payload)
    return {
        "Content-Type": "application/json",
        "Authorization": f"SHA256 Credential={APP_ID},Timestamp={ts},Signature={sig}",
    }


def _gql(query: str, variables: dict | None = None, dry_run: bool = False) -> dict:
    endpoint = ENDPOINTS.get(REGION, ENDPOINTS["my"])
    payload = json.dumps({"query": query, "variables": variables or {}})

    if dry_run:
        print(f"[DRY-RUN] Would POST to {endpoint}")
        print(f"[DRY-RUN] Query: {query[:80]}...")
        return {}

    headers = _headers(payload)
    resp = requests.post(endpoint, data=payload, headers=headers, timeout=30)

    if DEBUG:
        print(f"[DEBUG] HTTP {resp.status_code}: {resp.text[:200]}")

    if resp.status_code == 429:
        print("[WARN] Rate limited. Sleeping 5s...")
        time.sleep(5)
        return _gql(query, variables)

    resp.raise_for_status()
    return resp.json()


PRODUCT_SEARCH_QUERY = """
query searchProducts($keyword: String!, $limit: Int!) {
  productOfferV2(keyword: $keyword, limit: $limit) {
    nodes {
      itemId
      shopId
      productName
      commissionRate
      price
      sales
      shopName
      productLink
      offerLink
    }
  }
}
"""

COMMISSION_QUERY = """
query getCommissionSummary {
  affiliateSummary {
    confirmedCommission
    pendingCommission
    totalEarnings
  }
}
"""


def search_and_export(keyword: str, limit: int, dry_run: bool, output_file: str):
    print(f"Fetching products for keyword: {keyword}")

    if dry_run:
        print(f"[DRY-RUN] Would fetch {limit} products for '{keyword}'")
        print(f"[DRY-RUN] Would generate affiliate links for {limit} products")
        print(f"[DRY-RUN] Would export to {output_file}")
        print("Dry run complete. No API calls made.")
        return

    data = _gql(PRODUCT_SEARCH_QUERY, {"keyword": keyword, "limit": limit})
    products = data.get("data", {}).get("productOfferV2", {}).get("nodes", [])

    if not products:
        print("[WARN] No products returned. Check credentials and region.")
        return

    print(f"Found {len(products)} products")
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["product_name", "shop_name", "price", "commission_rate",
                        "sales", "product_link", "affiliate_link"],
        )
        writer.writeheader()
        for p in products:
            writer.writerow({
                "product_name": p.get("productName", ""),
                "shop_name": p.get("shopName", ""),
                "price": p.get("price", ""),
                "commission_rate": p.get("commissionRate", ""),
                "sales": p.get("sales", ""),
                "product_link": p.get("productLink", ""),
                "affiliate_link": p.get("offerLink", ""),
            })

    print(f"Exported to {output_file}")


def show_report(dry_run: bool):
    if dry_run:
        print("[DRY-RUN] Would fetch commission summary from API")
        return

    data = _gql(COMMISSION_QUERY, dry_run=dry_run)
    summary = data.get("data", {}).get("affiliateSummary", {})
    print("\n=== Commission Summary ===")
    print(f"Confirmed: {summary.get('confirmedCommission', 'N/A')}")
    print(f"Pending:   {summary.get('pendingCommission', 'N/A')}")
    print(f"Total:     {summary.get('totalEarnings', 'N/A')}")


def main():
    parser = argparse.ArgumentParser(description="Shopee Affiliate link generator")
    parser.add_argument("--keyword", default=os.getenv("DEFAULT_KEYWORD", "skincare"))
    parser.add_argument("--limit", type=int, default=int(os.getenv("DEFAULT_LIMIT", "20")))
    parser.add_argument("--output", default="output/links.csv")
    parser.add_argument("--report", action="store_true", help="Show commission summary")
    parser.add_argument("--dry-run", action="store_true", default=os.getenv("DRY_RUN", "false").lower() == "true")
    args = parser.parse_args()

    if not args.dry_run and (not APP_ID or APP_ID == "your_app_id_here"):
        print("[FAIL] APP_ID not set. Run setup.sh first or set in config/.env")
        raise SystemExit(1)

    if args.report:
        show_report(dry_run=args.dry_run)
    else:
        search_and_export(args.keyword, args.limit, args.dry_run, args.output)


if __name__ == "__main__":
    main()
