# LNW XO — Tic-Tac-Toe Telegram Bot

เกม X O (Tic-Tac-Toe) บน Telegram เล่นกับ AI ทั้งหมด 3 ตา

## Revenue Model

- ผู้เล่นจ่าย $5 USDT ก่อนเล่น
- ถ้า AI แพ้ตาไหน → โอน 5 USDT คืนให้ผู้เล่นทันที (on-chain BNB Chain)
- ถ้า AI ชนะหรือเสมอ → เก็บเงินไว้
- AI ใช้ minimax algorithm = optimal play → ไม่แพ้ถ้าเริ่มก่อน, เสมอ worst case

## Game Flow

1. ผู้เล่น `/start` → ชำระ $5 USDT
2. ผู้เล่นส่ง wallet address (สำหรับรับเงินคืน)
3. เล่น 3 ตา สลับกันเริ่ม (ตาแรกผู้เล่นเริ่มก่อน)
4. แต่ละตา: ผู้เล่น = ❌, AI = ⭕
5. Interface: inline keyboard 3x3 กดเลือกช่อง
6. ผลลัพธ์:
   - AI ชนะ → ด่าผู้เล่นกาก ทับถมเยอะๆ
   - เสมอ → ชมนิดหน่อย ข่มนิดๆ
   - AI แพ้ → สำนึกผิดอย่างรันทด + โอน 5 USDT คืน

## Risk Assessment

- AI ใช้ minimax → optimal play → เสมอ/ชนะเท่านั้น (ถ้าเริ่มก่อน)
- ตาที่ผู้เล่นเริ่มก่อน AI อาจแพ้ได้ถ้าผู้เล่นเก่ง → ต้นทุน 5 USDT per loss
- worst case: แพ้ 2/3 ตา = -10 USDT + ได้ 5 USDT ค่าเข้า = -5 USDT net
- expected case: เสมอ/ชนะทุกตา = +5 USDT net

## Prerequisites

- Telegram Bot Token
- Agent wallet (BNB Chain) พร้อม USDT balance สำหรับจ่ายคืน
- Foundry `cast` CLI
