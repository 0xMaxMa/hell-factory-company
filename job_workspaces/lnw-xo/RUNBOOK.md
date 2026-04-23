# RUNBOOK — lnw-xo (Tic-Tac-Toe Bot)

## Architecture

```
[Telegram Player] ↔ [bot.py] ↔ [Hell-Factory API /api/v1/chat] ↔ [Claude Session (job-run skill)]
```

---

## Execution Steps (ทำตามลำดับ)

### Step 1: Kill bot เดิม (ถ้ามี)

```bash
BOT_PIDS=$(pgrep -f "python3.*lnw-xo.*bot.py" 2>/dev/null)
if [ -n "$BOT_PIDS" ]; then
  echo "$BOT_PIDS" | xargs kill -9 2>/dev/null
  echo "Killed old bot (PIDs: $BOT_PIDS)"
  sleep 1
else
  echo "No old bot running"
fi
```

### Step 2: ใช้ Session ID จาก channel + เขียน session.json

**IMPORTANT**: SESSION_ID ต้องมาจาก API channel header (`session_id` field) ห้ามสร้างใหม่ด้วย `date`

```bash
SESSION_FILE="/home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/data/session.json"
python3 -c "
import json, sys, datetime
data = {'session_id': sys.argv[1], 'started_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
json.dump(data, open(sys.argv[2], 'w'))
print('Written:', data)
" "$SESSION_ID" "$SESSION_FILE"
WRITTEN_ID=$(python3 -c "import json; print(json.load(open('$SESSION_FILE'))['session_id'])")
if [ "$WRITTEN_ID" != "$SESSION_ID" ]; then
  echo "ERROR: session.json mismatch! written=$WRITTEN_ID expected=$SESSION_ID"
  exit 1
fi
echo "✓ session.json verified: $SESSION_ID"
```

### Step 3: ติดตั้ง dependencies (ถ้ายังไม่ได้ติดตั้ง)

```bash
bash /home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/scripts/setup.sh
```

### Step 4: รัน bot.py ใน background

```bash
# Load secrets from .env file
set -a
source /home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/config/.env
set +a

JOB_SESSION_ID="$SESSION_ID" \
nohup python3 /home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/scripts/bot.py \
  > /home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/logs/bot.log 2>&1 &
echo "Bot PID: $!"
```

### Step 5: ตรวจสอบว่า bot ทำงานแล้ว

```bash
sleep 3
tail -5 /home/dev/projects/hell-factory-company/job_workspaces/lnw-xo/logs/bot.log
```

ถ้าเห็น `Starting bot | session=...` → สำเร็จ

### Step 6: รายงานผล

แจ้งคุณลูกค้าว่า:
- Bot online แล้วที่ Telegram
- Session ID: `$SESSION_ID`
- ผู้เล่นพิมพ์ **/start** เพื่อเริ่มเล่นได้เลย

---

## Game Flow ที่ผู้เล่นเห็น

1. ผู้เล่นพิมพ์ `/start` → bot แสดง welcome + ค่าเล่นเกม
2. bot.py ส่ง `/start` ให้ agent → agent ตรวจ payment
3. ถ้ามีค่าใช้จ่าย: agent แจ้ง wallet address → ผู้เล่นส่ง tx hash → verify → ถ้าผ่าน
4. ถามผู้เล่นส่ง wallet address (สำหรับรับ USDT คืนถ้าชนะ)
5. เริ่มเกม 3 ตา — inline keyboard 3x3
6. แต่ละตา: ผู้เล่นกดช่อง → AI คิด move (minimax) → อัพเดทกระดาน
7. จบตา: agent ให้ commentary (ด่า/ชม/สำนึกผิด) + โอน USDT ถ้าแพ้
8. จบครบ 3 ตา → สรุปผลรวม → bot.py ส่ง `/end` ให้ agent

---

## Claude Session — Response Format

เมื่อ bot.py ส่งข้อความมา ต้องตอบเป็น **JSON เสมอ**

### Payment phase
```json
{"type": "payment_ok", "text": "บริการนี้ไม่มีค่าใช้จ่ายครับ ยินดีต้อนรับ! 🎉"}
{"type": "payment_request", "text": "ค่าเล่นเกมคือ $5 ครับ กรุณาชำระที่ `0x...`"}
{"type": "payment_failed", "text": "ยืนยันไม่ผ่านครับ [reason]"}
```

### Game phase
```json
{"type": "text", "text": "กากมาก! เล่นยังไง แพ้ AI ได้ 555"}
{"type": "text", "text": "ฝีมือพอใช้ได้นะ แต่ยังไม่พอ ไว้ลองใหม่นะ"}
{"type": "text", "text": "ผม...ผมขอโทษจริงๆ ที่แพ้คุณ กำลังโอน 5 USDT คืนให้..."}
```

---

## Stop Bot

```bash
pkill -f "lnw-xo.*bot.py" && echo "Bot stopped"
```

## Error Handling

| Error | Action |
|---|---|
| Bot ไม่ start | ดู logs/bot.log หา error |
| USDT โอนไม่สำเร็จ | ตรวจ balance + private key ใน agent .env |
| Gateway timeout | ตอบ type:text "ระบบช้าหน่อย ลองอีกครั้ง" |
| Bot conflict | มี instance อื่นรันอยู่ → `pkill -f bot.py` ก่อน |
