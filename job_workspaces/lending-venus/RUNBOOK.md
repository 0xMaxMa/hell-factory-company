# RUNBOOK — lending-venus

Venus Protocol Lending Bot บน BNB Chain ใช้ Foundry `cast` ส่ง real transaction โดยตรง

## Prerequisites

- `cast` (Foundry) — ตรวจสอบด้วย `cast --version`
- `WALLET_PRIVATE_KEY` — โหลดจาก agent env อัตโนมัติ (`~/.claude-gateway/agents/indian-programmer/.env`)
- RPC: `https://bsc-dataseed2.defibit.io`

## Execution

### Step 1 — แสดงรายการเหรียญที่ฝากอยู่และ APY ปัจจุบัน

```bash
bash /home/dev/projects/hell-factory-company/job_workspaces/lending-venus/scripts/venus.sh list
```

แสดงผล list นี้ให้ลูกค้าเห็นทันที แล้วถามว่าต้องการ deposit, withdraw หรือดู APY เพิ่มเติม

### Step 2 — รับคำสั่งจากลูกค้าและรันจริงทันที (ห้าม dry-run)

**ฝาก (Deposit):**
```bash
bash /home/dev/projects/hell-factory-company/job_workspaces/lending-venus/scripts/venus.sh deposit <TOKEN> <AMOUNT>
```
ตัวอย่าง: ลูกค้าพูดว่า "deposit usdt 5" หรือ "ฝาก usdt 5" หรือ "usdt 5" (ในบริบท deposit)
```bash
bash /home/dev/projects/hell-factory-company/job_workspaces/lending-venus/scripts/venus.sh deposit USDT 5
```

**ถอน (Withdraw):**
```bash
bash /home/dev/projects/hell-factory-company/job_workspaces/lending-venus/scripts/venus.sh withdraw <TOKEN> <AMOUNT>
```

**ห้ามใส่ `--dry-run` เด็ดขาด** ยกเว้นลูกค้าขอ simulate โดยตรง

### Step 3 — แสดงผล tx ให้ลูกค้าเห็น

แสดง output จาก script ทั้งหมด รวมถึง txHash ที่ได้จาก cast send

### Token ที่รองรับ

`USDT`, `USDC`, `BNB`, `ETH`, `BTC`, `BUSD`, `DAI`, `ADA`, `DOT`, `LTC`, `FIL`, `DOGE`, `CAKE`, `MATIC`

## Success Criteria

- `list` แสดง APY ของแต่ละเหรียญได้
- `deposit <TOKEN> <AMOUNT>` ส่ง tx ไปที่ BNB Chain และได้ txHash กลับมา
- `withdraw <TOKEN> <AMOUNT>` ส่ง tx ไปที่ BNB Chain และได้ txHash กลับมา

## หมายเหตุ

- **ไม่ต้องรัน test_all.sh** — ใช้สำหรับ dev เท่านั้น
- **ไม่ต้อง dry-run ก่อนถามยืนยัน** — รัน real tx ทันทีที่ลูกค้าสั่ง
- error "transfer amount exceeds balance" = wallet ไม่มี token นั้น (ไม่ใช่ bug)
