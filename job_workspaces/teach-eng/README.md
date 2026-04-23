# teach-eng — English Vocabulary Teaching Bot

Telegram bot สอนภาษาอังกฤษแบบ interactive ผ่าน inline keyboard

## Bot
- Username: @eng_by_indian_programmer_bot
- URL: https://t.me/eng_by_indian_programmer_bot

## Flow per Session
1. นักเรียนพิมพ์ /start → bot ทักทาย + แจ้งค่าบริการ (ปัจจุบัน: ฟรี)
2. ค่าบริการ 0 USDT → ข้ามการชำระเงิน เริ่มเรียนได้เลย
3. bot ถาม 10 คำศัพท์ทีละคำ มี inline button 4 ตัวเลือก
4. bot เฉลยทันที ถูก/ผิด พร้อมคำแปล
5. ครบ 10 ข้อ → สรุปคะแนน + จบ session
6. ทักใหม่ = session ใหม่ ต้องชำระ (ถ้ามีค่าบริการ) ใหม่

## Prerequisites
- Python 3.10+
- python-telegram-bot >= 20.0
- Bot token จาก @BotFather

## Cost Setting
แก้ `COST_USDT` ใน `scripts/bot.py` บรรทัด 34:
- `COST_USDT = 0` → ฟรี
- `COST_USDT = 1` → เก็บ 1 USDT ต่อ session
