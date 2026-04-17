---
name: crypto-wallet
description: "Manage EVM-compatible crypto wallet (BNB/ETH) — create wallet and get address for receiving payments"
---

# Crypto Wallet Skill

Manage an EVM-compatible crypto wallet (BNB Chain / Ethereum) for this agent.

## Commands

- `/crypto-wallet create` — generate a new wallet and save private key to .env
- `/crypto-wallet address` — show the wallet address (safe to share)

---

## Skill Directory

Scripts are located at:
`/home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/`

---

## How to Execute

### create — Generate a new wallet

Run with Bash:

```bash
python3 /home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/create_wallet.py
```

- If output is `ALREADY_EXISTS` → tell user a wallet already exists, use `address` command to view it
- If output contains `ADDRESS:0x...` → wallet created successfully, show the address (NOT the private key)

### address — Get wallet address

Run with Bash:

```bash
python3 /home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/get_address.py
```

- If `NO_WALLET` → tell user to run `create` first
- If `ADDRESS:0x...` → show address, mention it works on BNB Chain and Ethereum

## Important Rules

- **NEVER show or reveal the private key** — only show the wallet address
- The wallet address is safe to share for receiving payments
- BNB Chain (BSC) and Ethereum use the same address format (0x...)
- Always tell the user the network they should send on (BNB Chain = BEP-20)
