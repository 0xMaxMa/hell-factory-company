import os, re

env_path = os.path.expanduser("~/.claude-gateway/agents/indian-programmer/.env")
if not os.path.exists(env_path):
    print("NO_WALLET")
else:
    with open(env_path) as f:
        content = f.read()
    m = re.search(r"WALLET_ADDRESS=(0x[0-9a-fA-F]+)", content)
    if m:
        print(f"ADDRESS:{m.group(1)}")
    else:
        # Try to derive from private key
        mk = re.search(r"WALLET_PRIVATE_KEY=([0-9a-fA-F]+)", content)
        if mk:
            from eth_account import Account
            acc = Account.from_key(bytes.fromhex(mk.group(1)))
            print(f"ADDRESS:{acc.address}")
        else:
            print("NO_WALLET")
