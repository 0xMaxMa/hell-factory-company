import os, sys
from eth_account import Account

agent_dir = os.path.expanduser("~/.claude-gateway/agents/indian-programmer")
env_path = os.path.join(agent_dir, ".env")

# Check if wallet already exists
if os.path.exists(env_path):
    with open(env_path) as f:
        content = f.read()
    if "WALLET_PRIVATE_KEY" in content:
        print("ALREADY_EXISTS")
        sys.exit(0)

# Generate new wallet
Account.enable_unaudited_hdwallet_features()
acc = Account.create()

# Append to .env
with open(env_path, "a") as f:
    f.write(f"\nWALLET_PRIVATE_KEY={acc.key.hex()}\nWALLET_ADDRESS={acc.address}\n")

print(f"ADDRESS:{acc.address}")
