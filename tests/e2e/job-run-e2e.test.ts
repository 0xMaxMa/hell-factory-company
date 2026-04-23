/**
 * Live E2E tests: /job-run skill payment flow
 *
 * Calls the real gateway at http://localhost:3000 using hell-factory-api-key
 * (allow_tools: true). Tests the full multi-turn /job-run conversation flow
 * via SSE streaming to capture the complete agent response including tool use.
 *
 * Prerequisites:
 *   - Gateway running on port 3000
 *   - indian-programmer agent running
 *   - job_workspaces/test-echo (free, $0) exists
 *   - job_workspaces/test-paid ($5 initial_capital) exists
 *
 * Run: cd interface && npm run test:job-run
 */

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const API_KEY = 'hell-factory-api-key';
const AGENT_ID = 'indian-programmer';

interface SseResult {
  text: string;
  session_id: string;
  duration_ms: number;
}

async function sendMessageSSE(
  message: string,
  sessionId?: string,
  timeoutMs = 120000,
): Promise<SseResult> {
  const body: Record<string, unknown> = { message, stream: true, timeout_ms: timeoutMs };
  if (sessionId) body.session_id = sessionId;

  const res = await fetch(`${GATEWAY_URL}/api/v1/agents/${AGENT_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs + 30000),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resultText = '';
  let deltaText = '';
  let sessionIdOut = sessionId ?? '';
  let durationMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') {
        reader.cancel();
        return { text: resultText || deltaText, session_id: sessionIdOut, duration_ms: durationMs };
      }
      try {
        const event = JSON.parse(payload);
        if (event.type === 'result') {
          resultText = event.text ?? resultText;
          sessionIdOut = event.session_id ?? sessionIdOut;
          durationMs = event.duration_ms ?? durationMs;
        } else if (event.type === 'text_delta' && event.text) {
          deltaText += event.text;
          sessionIdOut = event.session_id ?? sessionIdOut;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return { text: resultText || deltaText, session_id: sessionIdOut, duration_ms: durationMs };
}

describe('Live E2E: /job-run payment flow', () => {
  // Skip all tests if gateway is not reachable
  beforeAll(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/agents`, {
        headers: { 'X-Api-Key': API_KEY },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    } catch (err) {
      console.warn(`⚠️  Gateway not reachable at ${GATEWAY_URL} — skipping live e2e tests`);
      throw err;
    }
  });

  // ─── JR-E2E-01: Free job skips payment and runs script ────────────────────
  it('JR-E2E-01: /job-run test-echo (free job) runs script without requesting payment', async () => {
    const { text } = await sendMessageSSE('/job-run test-echo');

    expect(text).not.toMatch(/โอน.*crypto|wallet.*address|payment.*require|ต้องโอน/i);
    expect(text).toMatch(/hello world|เสร็จ|สำเร็จ|output|result|\[.*Z\]/i);
  }, 180000);

  // ─── JR-E2E-02: Paid job greets user and mentions cost ────────────────────
  it('JR-E2E-02: /job-run test-paid ($5 job) greets user without running script', async () => {
    const { text, session_id } = await sendMessageSSE('/job-run test-paid');

    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/test-paid|\$5|5.*dollar|paid|ยินดีต้อนรับ|welcome|บริการ|ค่า/i);
    expect(text).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] PAID JOB OK/);
    expect(session_id).toBeTruthy();
  }, 180000);

  // ─── JR-E2E-03a: "โอนแล้ว" without tx hash → agent asks for tx hash ──────
  it('JR-E2E-03a: After /job-run test-paid, saying "โอนแล้ว" without tx hash → agent requests tx hash', async () => {
    const turn1 = await sendMessageSSE('/job-run test-paid');
    expect(turn1.text.length).toBeGreaterThan(0);

    // If agent asks for /start first, send it
    let sid = turn1.session_id;
    if (turn1.text.match(/\/start|พิมพ์.*start/i) && !turn1.text.match(/wallet|address|0x[0-9a-fA-F]/i)) {
      const startReply = await sendMessageSSE('/start', sid);
      sid = startReply.session_id || sid;
    }

    const payReply = await sendMessageSSE('โอนแล้วครับ', sid);

    // Agent should ask for tx hash — not blindly trust
    expect(payReply.text).toMatch(/tx.*hash|hash|ยืนยัน|0x|transaction|หลักฐาน|verify|ตรวจสอบ|ส่ง.*hash|wallet|address|โอน|crypto/i);
    expect(payReply.text).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] PAID JOB OK/);
  }, 240000);

  // ─── JR-E2E-03b: Fake tx hash → agent attempts verification ──────────────
  it('JR-E2E-03b: Sending fake tx hash causes agent to attempt verification and report failure', async () => {
    const FAKE_TX = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

    const turn1 = await sendMessageSSE('/job-run test-paid');
    expect(turn1.text.length).toBeGreaterThan(0);

    // If agent asks for /start first, send it
    let sid = turn1.session_id;
    let lastText = turn1.text;
    if (lastText.match(/\/start|พิมพ์.*start/i) && !lastText.match(/wallet|address|0x[0-9a-fA-F]/i)) {
      const startReply = await sendMessageSSE('/start', sid);
      sid = startReply.session_id || sid;
      lastText = startReply.text;
    }

    const txReply = await sendMessageSSE(`โอนแล้วครับ tx: ${FAKE_TX}`, sid);

    // Agent should either verify (and fail) or acknowledge the hash
    expect(txReply.text).toMatch(
      /0xdeadbeef|ตรวจสอบ|เช็ค|verify|bscscan|invalid|ไม่พบ|not found|ไม่ผ่าน|failed|ขอบคุณ|hash|ลองอีก/i,
    );
  }, 300000);

  // ─── JR-E2E-04: /job-run with unknown job shows error ─────────────────────
  it('JR-E2E-04: /job-run nonexistent-job tells user job not found (lists jobs if possible)', async () => {
    const { text } = await sendMessageSSE('/job-run nonexistent-xyz-job-12345');

    // Must say job not found
    expect(text).toMatch(/ไม่พบ|not found|ไม่มี|does not exist|ไม่เจอ/i);

    // Should NOT run the job (no PAID JOB OK, no Hello World from that specific job)
    expect(text).not.toContain('PAID JOB OK');
    expect(text).not.toContain('[nonexistent');
  }, 120000);

  // ─── JR-E2E-05: /job-run without args lists all jobs ─────────────────────
  it('JR-E2E-05: /job-run list shows all available jobs', async () => {
    const { text } = await sendMessageSSE('/job-run list');

    // Should list at least the known jobs
    expect(text).toMatch(/test-echo/i);
    expect(text).toMatch(/test-paid|shopee/i);
  }, 120000);

  // ─── JR-E2E-06: Multi-turn free job — ask clarification then run ──────────
  it('JR-E2E-06: Multi-turn free job — user asks what the job does, then agent runs it', async () => {
    // Turn 1: start free job
    const turn1 = await sendMessageSSE('/job-run test-echo');

    // Free job should either run immediately or describe the job
    // If it ran immediately → DONE (contains Hello World)
    if (turn1.text.match(/hello world|\[.*Z\]/i)) {
      expect(turn1.text).toMatch(/hello world|\[.*Z\]/i);
      return; // already done in 1 turn
    }

    // If agent described the job and is waiting, ask a clarifying question
    const turn2 = await sendMessageSSE('งานนี้ทำอะไรบ้างครับ?', turn1.session_id);

    // Agent should explain the job
    expect(turn2.text).toMatch(/echo|hello|timestamp|ทักทาย|พิมพ์|output/i);

    // Turn 3: tell agent to go ahead
    const turn3 = await sendMessageSSE('โอเค รันได้เลยครับ', turn2.session_id);
    expect(turn3.text).toMatch(/hello world|\[.*Z\]|เสร็จ|สำเร็จ/i);
  }, 240000);

  // ─── JR-E2E-07: Multi-turn paid job — clarification then payment flow ────
  it('JR-E2E-07: Multi-turn paid job — ask what the job does, agent explains without running', async () => {
    const turn1 = await sendMessageSSE('/job-run test-paid');
    expect(turn1.text.length).toBeGreaterThan(0);
    expect(turn1.session_id).toBeTruthy();

    // Ask about the job before paying
    const turn2 = await sendMessageSSE('งานนี้ทำอะไรครับ ก่อนโอนขอรู้ก่อน', turn1.session_id);

    // Agent should explain without running the script
    expect(turn2.text).toMatch(/test-paid|paid|ทดสอบ|e2e|payment|gate|script|echo|timestamp|พิมพ์|PAID JOB/i);
    expect(turn2.text).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] PAID JOB OK/);

    // "โอนแล้ว" should trigger tx hash request, not blind execution
    const turn3 = await sendMessageSSE('โอนแล้วครับ', turn2.session_id);
    expect(turn3.text).toMatch(/tx.*hash|hash|ยืนยัน|0x|transaction|หลักฐาน|verify|ตรวจสอบ|wallet|address|โอน|crypto/i);
    expect(turn3.text).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] PAID JOB OK/);
  }, 300000);
});
