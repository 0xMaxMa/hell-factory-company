# RUNBOOK — teach-eng (English Teaching Bot)

## Architecture

```
[Telegram Student] ↔ [bot.py] ↔ [Hell-Factory API /api/v1/chat] ↔ [Claude Session (job-run skill)]
```

---

## Execution Steps (ทำตามลำดับ)

### Step 1: Kill bot เดิม (ถ้ามี)

```bash
BOT_PIDS=$(pgrep -f "python3.*bot.py" 2>/dev/null)
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
# SESSION_ID ต้องถูกส่งมาจาก job-run caller (channel session_id)
# ตัวอย่าง: SESSION_ID="job-teach-eng-1776914045551"
SESSION_FILE="/home/dev/projects/hell-factory-company/job_workspaces/teach-eng/data/session.json"
python3 -c "
import json, sys, datetime
data = {'session_id': sys.argv[1], 'started_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
json.dump(data, open(sys.argv[2], 'w'))
print('Written:', data)
" "$SESSION_ID" "$SESSION_FILE"
# ตรวจสอบว่า session.json ถูกเขียนและ session_id ถูกต้อง
WRITTEN_ID=$(python3 -c "import json; print(json.load(open('$SESSION_FILE'))['session_id'])")
if [ "$WRITTEN_ID" != "$SESSION_ID" ]; then
  echo "ERROR: session.json mismatch! written=$WRITTEN_ID expected=$SESSION_ID"
  exit 1
fi
echo "✓ session.json verified: $SESSION_ID"
```

### Step 3: ติดตั้ง dependencies (ถ้ายังไม่ได้ติดตั้ง)

```bash
bash /home/dev/projects/hell-factory-company/job_workspaces/teach-eng/scripts/setup.sh
```

### Step 4: รัน bot.py ใน background

```bash
# Load secrets from .env file
set -a
source /home/dev/projects/hell-factory-company/job_workspaces/teach-eng/config/.env
set +a

JOB_SESSION_ID="$SESSION_ID" \
nohup python3 /home/dev/projects/hell-factory-company/job_workspaces/teach-eng/scripts/bot.py \
  > /home/dev/projects/hell-factory-company/job_workspaces/teach-eng/logs/bot.log 2>&1 &
echo "Bot PID: $!"
```

### Step 5: ตรวจสอบว่า bot ทำงานแล้ว

```bash
sleep 3
tail -5 /home/dev/projects/hell-factory-company/job_workspaces/teach-eng/logs/bot.log
```

ถ้าเห็น `Starting bot | session=...` → สำเร็จ

### Step 6: รายงานผล

แจ้งคุณลูกค้าว่า:
- Bot online แล้วที่ @eng_by_indian_programmer_bot
- Session ID: `$SESSION_ID`
- นักเรียนพิมพ์ **/start** เพื่อเริ่มใช้บริการได้เลย

---

## Flow ที่นักเรียนเห็น

1. นักเรียนพิมพ์ `/start` ใน Telegram
2. bot.py ส่ง `/start` ให้ agent → agent ตรวจ payment
3. ถ้าฟรี ($0): agent ตอบ `payment_ok` → bot.py เริ่มสอนทันที
4. ถ้ามีค่าใช้จ่าย: agent แจ้งค่าบริการและ wallet address → นักเรียนส่ง tx hash → bot.py ส่งให้ agent verify → ถ้าผ่านเริ่มสอน
5. สอนคำศัพท์ 10 ข้อ พร้อม inline keyboard 4 ตัวเลือก
6. จบ session → bot.py ส่ง `/end` ให้ agent reset

---

## Claude Session — Response Format (สำคัญมาก)

เมื่อ bot.py ส่งข้อความมา ต้องตอบเป็น **JSON เสมอ** ห้ามตอบข้อความธรรมดา

### Payment phase
```json
{"type": "payment_ok", "text": "บริการนี้ไม่มีค่าใช้จ่ายครับ ยินดีต้อนรับ! 🎉"}
{"type": "payment_request", "text": "ค่าบริการคือ $5 ครับ กรุณาชำระที่ `0x...`"}
{"type": "payment_failed", "text": "ยืนยันไม่ผ่านครับ [reason]"}
```

### Lesson phase
```json
{ "type": "text", "text": "สวัสดีนักเรียนครับ! ..." }
{
  "type": "question",
  "text": "📖 ข้อที่ 3/10\n\n*apple* แปลว่าอะไรครับ?",
  "choices": ["แอปเปิ้ล", "ส้ม", "กล้วย", "มะม่วง"]
}
{ "type": "summary", "text": "🎉 จบแล้วครับ! คะแนน: 8/10\n..." }
```

---

## Teaching Flow ที่ Claude Session ต้องทำ

**เมื่อรับ TEACHER_CONTEXT แล้ว "เริ่มโจทย์ข้อที่ 1":**
1. ทักทายนักเรียน (type: text)
2. ส่งโจทย์ข้อที่ 1 ทันที (type: question, 4 choices)

**เมื่อรับ `answer:xxx`:**
1. ตรวจว่าถูกหรือผิด → เฉลย (type: text)
2. ถ้ายังไม่ครบ 10 ข้อ → ส่งโจทย์ถัดไป (type: question)
3. ครบ 10 ข้อ → สรุปคะแนน (type: summary)

**เลือกคำศัพท์ 10 คำแบบ random** จากคลังคำศัพท์ภาษาอังกฤษ-ไทย
**choices ต้องมี 4 ตัวเลือกเสมอ** (1 ถูก + 3 ผิด random จากคำอื่น)

---

## Stop Bot

```bash
pkill -f "bot.py" && echo "Bot stopped"
```

## Error Handling

| Error | Action |
|---|---|
| Bot ไม่ start | ดู logs/bot.log หา error |
| `HELL_FACTORY_API_KEY` ผิด | ตรวจ config.json ใน interface |
| Gateway timeout | ตอบ type:text "ระบบช้าหน่อย ลองอีกครั้ง" |
| Bot conflict | มี instance อื่นรันอยู่ → `pkill -f bot.py` ก่อน |
