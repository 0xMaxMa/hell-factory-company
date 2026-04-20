# Shopee Affiliate — Earn Commissions by Promoting Products

## What This Job Is

Promote Shopee products via affiliate links and earn commission when buyers purchase through your links. Works across Southeast Asia and Taiwan.

## Revenue Model

| Source | Rate |
|--------|------|
| Base commission (most categories) | 2.5% – 12% |
| Seller bonus (CommsXtra) | Up to 25–40% |
| Indirect order bonus (new Jan 2026) | 30% of full commission |

- Attribution window: **7 days** (last-click model)
- Validation period: **2 months** before commission confirmed
- Payout threshold: ~RM50 (Malaysia) / ~$10–50 USD equivalent per region

## Target Markets

Thailand · Singapore · Indonesia · Malaysia · Philippines · Vietnam · Taiwan

## Prerequisites

- Shopee account (same region as target market)
- Approved affiliate account at `affiliate.shopee.com.my` or regional equivalent
- AppID + Secret from affiliate dashboard (for API access)

## API Access

**GraphQL Endpoints by Region:**

| Region | Endpoint |
|--------|----------|
| Malaysia | `https://open-api.affiliate.shopee.com.my/graphql` |
| Indonesia | `https://open-api.affiliate.shopee.co.id/graphql` |
| Vietnam | `https://open-api.affiliate.shopee.vn/explorer/v2` |

**Auth:** SHA256 HMAC signature in Authorization header  
**Rate limit:** 100 requests/minute  
**Token validity:** 4 hours  

## Risks & Limitations

- Fraud detection is aggressive — personal purchases or same-IP clicks are rejected
- Do NOT share affiliate links via messaging apps (violates ToS)
- 2-month validation delay before commissions are confirmed
- Last-click only — if buyer clicks competitor's link after yours, you lose commission
- Minimum payout threshold must be reached before withdrawal
