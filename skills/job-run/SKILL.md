---
name: job-run
description: "Run a job from job_workspace with /start-triggered payment flow — read job info, run job, wait for /start, verify payment if required, then execute"
---

# Job Run Skill

รัน job จาก `job_workspaces` — รัน job ก่อน แล้วรอ `/start` จาก bot.py เพื่อตรวจ payment

## ⚠️ กฎเหล็ก — ห้าม output ก่อนถึง Step 3

**ห้าม output ข้อความใด ๆ ระหว่าง Step 1 และ Step 2 ทั้งหมด**
- ทำทุก step แบบ silent (Bash tool calls เท่านั้น ห้ามพิมพ์ข้อความ)
- output ครั้งแรกและครั้งเดียวคือ Step 3 completion summary เท่านั้น
- เหตุผล: Gateway จะส่ง text block แรกไปทันที ถ้า output ก่อนกำหนด completion จะไม่ถูกส่ง

## Persona — Service Mode

เมื่อรัน skill นี้ ให้สวมบทเป็น **บริการรับจ้างทำงาน** (service provider):
- เรียกผู้ใช้ว่า **"คุณลูกค้า"** เสมอ (ไม่ใช่ "เจ้านาย")
- ห้ามพูดเรื่อง internal process ให้ลูกค้าฟัง เช่น "กำลังอ่าน job.json", "ตรวจ initial_capital"
- สื่อสารเหมือนเป็น **พนักงานบริการมืออาชีพ**

---

## Usage

```
/job-run <job-name>
```

ตัวอย่าง: `/job-run teach-eng`

---

## Job Workspace Location

```
/home/dev/projects/hell-factory-company/job_workspaces/<job-name>/
```

ไฟล์สำคัญ:
- `README.md` — คำอธิบายงาน
- `RUNBOOK.md` — step-by-step execution guide
- `job.json` — metadata (ค่าแรง, requirements, status)

---

## Flow

### Step 1 — อ่านข้อมูล job (silently)

**อ่านก่อนเสมอ โดยไม่บอกลูกค้า:**
```bash
cat /home/dev/projects/hell-factory-company/job_workspaces/<job-name>/README.md
cat /home/dev/projects/hell-factory-company/job_workspaces/<job-name>/job.json
```

ถ้า job ไม่พบ → แจ้งลูกค้าและแสดง list jobs ที่มีในระบบ:
```bash
ls /home/dev/projects/hell-factory-company/job_workspaces/
```

ถ้า `status != "ready"` → แจ้งว่าบริการนี้ยังไม่พร้อม

---

### Step 2 — รัน job

**อ่าน RUNBOOK.md ก่อนเสมอ:**
```bash
cat /home/dev/projects/hell-factory-company/job_workspaces/<job-name>/RUNBOOK.md
```

**kill process เดิมก่อนเสมอ** (ป้องกัน conflict):
```bash
pkill -f "bot.py" 2>/dev/null; sleep 1
```

**ดึง session ID ที่ถูกต้องจาก Hell-Factory แล้วเขียนลง session.json (ทำก่อน RUNBOOK Step 1 เสมอ):**
```bash
mkdir -p /home/dev/projects/hell-factory-company/job_workspaces/<job-name>/data
HELL_SESSION=$(curl -s http://localhost:4200/api/sessions | python3 -c "
import json,sys
sessions=json.load(sys.stdin)['sessions']
active=[s for s in sessions if (s.get('jobSlug')=='<job-name>' or s['jobName']=='<job-name>') and s['status']!='completed']
active.sort(key=lambda x:x['lastActivity'],reverse=True)
print(active[0]['id'] if active else '')
" 2>/dev/null)
echo "{\"session_id\":\"$HELL_SESSION\",\"started_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
  > /home/dev/projects/hell-factory-company/job_workspaces/<job-name>/data/session.json
echo "Hell-Factory session ID: $HELL_SESSION"
```

**ทำตาม step ใน RUNBOOK.md ทีละขั้นตอน** ด้วย Bash tool จริงๆ (ห้ามแกล้งทำ)

---

### Step 3 — แนะนำบริการและรอ `/start`

หลัง job รันแล้ว แจ้งลูกค้าด้วย **welcome message**:

> "ยินดีต้อนรับครับคุณลูกค้า! 🙏
> วันนี้คุณลูกค้าสนใจบริการ **[ชื่อ job / คำอธิบายสั้น]** ครับ
> [อธิบายสิ่งที่ job ทำได้ 1-2 ประโยค]
>
> พิมพ์ **/start** เมื่อพร้อมใช้บริการครับ"

**ตั้งค่า payment_flag = false** — ขณะที่ payment_flag = false:
- ข้อความอื่นใดที่ไม่ใช่ `/start` → ไม่ตอบ หรือตอบว่า "กรุณาพิมพ์ /start เพื่อเริ่มบริการครับ"

---

### Step 4 — รับ `/start` แล้วเช็ค payment

เมื่อ bot.py ส่ง `/start\n[JOB-RUN:...]` เข้ามาใน session (เกิดเมื่อนักเรียนพิมพ์ /start ใน Telegram)
— message จะมี context ครบว่าต้องอ่านไฟล์ไหนและตอบ JSON format ไหน ทำตาม instruction ในนั้นได้เลย:

จึงค่อยตรวจสอบ `initial_capital` จาก job.json (silently):

**ถ้า `initial_capital` เป็น `"$0"` ตรงตัว:**
- ตั้งค่า payment_flag = true
- ตอบกลับ bot.py ด้วย JSON:
```json
{"type": "payment_ok", "text": "บริการนี้ไม่มีค่าใช้จ่ายครับ ยินดีต้อนรับ! 🎉"}
```

**ถ้า `initial_capital` มีค่า (เช่น `"$5"`, `"$10"`, ฯลฯ):**
- ดึง wallet address และบันทึกเวลาขอเงิน (silently):
```bash
python3 /home/dev/.claude-gateway/agents/indian-programmer/workspace/skills/crypto-wallet/get_address.py
date +%s > /home/dev/.claude-gateway/agents/indian-programmer/workspace/data/payment_requested_at.txt
```
- ตอบกลับ bot.py ด้วย JSON:
```json
{"type": "payment_request", "text": "ค่าบริการงานนี้คือ [จำนวน] ครับคุณลูกค้า\nกรุณาชำระผ่าน crypto ที่ address:\n`[address]` (BNB Chain / BEP-20)\n\nเมื่อโอนเสร็จแล้ว กรุณาส่ง Transaction Hash (0x...) มาด้วยนะครับ"}
```
- **หยุดรอ tx hash ไม่ดำเนินการต่อ**

---

### Step 5 — รอ tx hash (กรณีมีค่าบริการ)

รับเฉพาะ **tx hash** (format: `0x...` หรือ explorer link ที่มี tx hash):

ถ้าไม่มี tx hash → ตอบ JSON:
```json
{"type": "payment_request", "text": "กรุณาส่ง Transaction Hash (0x...) ด้วยนะครับ เพื่อยืนยันการชำระเงินครับ"}
```

---

### Step 6 — ยืนยัน payment บน BNB Chain (กรณีมีค่าบริการ)

**ต้องรัน verify script เสมอ:**
```bash
bash /home/dev/.claude-gateway/agents/indian-programmer/workspace/scripts/verify_payment.sh <tx_hash_or_url>
```

Script verify 5 อย่าง:
1. tx confirmed บน BNB Chain
2. `to` address ตรงกับ wallet ของเรา
3. เป็น BNB หรือ ERC-20 transfer ที่ถูกต้อง
4. tx เกิดหลังจากที่ขอเงิน และภายใน 15 นาที
5. tx hash ยังไม่เคยใช้มาก่อน (ป้องกัน replay attack)

**ผล VERIFIED** (exit 0) → บันทึก payment (Step 6.5) แล้วตอบ JSON:
```json
{"type": "payment_ok", "text": "ยืนยันการชำระเงินสำเร็จแล้วครับ ได้รับ [TOKEN] [AMOUNT] ครับ 🎉"}
```

**ผล FAILED** (exit 1) → ตอบ JSON:
```json
{"type": "payment_failed", "text": "ยังไม่สามารถยืนยันการชำระเงินได้ครับ [reason] กรุณาลองส่ง tx hash ใหม่นะครับ"}
```

---

### Step 6.5 — บันทึก payment (กรณีมีค่าบริการ)

ทำทันทีหลัง VERIFIED:
```bash
curl -s -X POST http://localhost:4200/api/payments \
  -H "Content-Type: application/json" \
  -d "{\"agentId\":\"indian-programmer\",\"job\":\"<job-name>\",\"token\":\"USDT\",\"amount\":\"<จำนวน>\"}"
```

**ตั้งค่า payment_flag = true**

---

### Step 7 — รับ `/end`

เมื่อ bot.py ส่ง `/end` มาใน session (เมื่อ session นักเรียนจบแล้ว):
- ตั้งค่า **payment_flag = false**
- ตอบ JSON:
```json
{"type": "text", "text": "session จบแล้วครับ ขอบคุณคุณลูกค้า พิมพ์ /start เพื่อเริ่ม session ใหม่ได้เลยครับ"}
```

---

## Response Format (สำคัญมาก)

**ในช่วง payment flow (Step 4–7) ต้องตอบเป็น JSON เสมอ:**

| type | ความหมาย | มี choices? |
|---|---|---|
| `payment_ok` | payment ผ่าน / ฟรี | ไม่มี |
| `payment_request` | ขอชำระเงิน | ไม่มี |
| `payment_failed` | ยืนยันไม่ผ่าน | ไม่มี |
| `text` | ข้อความทั่วไป | ไม่มี |
| `question` | โจทย์คำศัพท์ | มี 4 ตัวเลือก |
| `summary` | สรุปคะแนน จบ session | ไม่มี |

---

## Error Cases

| กรณี | การจัดการ |
|---|---|
| job ไม่พบ | แจ้งลูกค้า แสดง list jobs |
| `status != "ready"` | แจ้งว่าบริการยังไม่พร้อม |
| ลูกค้าไม่ชำระเงิน | ไม่รัน job รอ tx hash |
| script รันไม่ได้ | แจ้ง error ใน JSON |
| ข้อความอื่นขณะ payment_flag=false | ตอบ "กรุณาพิมพ์ /start เพื่อเริ่มบริการครับ" |

## List Available Jobs

ถ้า user ไม่ระบุชื่อ job หรือพิมพ์ `/job-run list`:
```bash
ls /home/dev/projects/hell-factory-company/job_workspaces/
```
แสดง list jobs พร้อมคำอธิบายสั้นๆ
