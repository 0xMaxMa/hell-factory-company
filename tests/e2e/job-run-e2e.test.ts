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
 * Run: jest tests/e2e/job-run-e2e.test.ts --testTimeout=120000
 */

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const API_KEY = 'hell-factory-api-key';
const AGENT_ID = 'indian-programmer';

interface SseResult {
  text: string;
  session_id: string;
  duration_ms: number;
}

/**
 * Send a message via SSE streaming and collect the full final response.
 * Waits for `data: [DONE]` before resolving.
 */
async function sendMessageSSE(
  message: string,
  sessionId?: string,
  timeoutMs = 90000,
): Promise<SseResult> {
  const body: Record<string, unknown> = { message, stream: true, timeout_ms: timeoutMs };
  if (sessionId) body.session_id = sessionId;

  const res = await fetch(`${GATEWAY_URL}/api/v1/agents/${AGENT_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs + 10000),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // Read SSE stream until [DONE]
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resultText = '';
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
        return { text: resultText, session_id: sessionIdOut, duration_ms: durationMs };
      }
      try {
        const event = JSON.parse(payload);
        if (event.type === 'result') {
          resultText = event.text ?? resultText;
          sessionIdOut = event.session_id ?? sessionIdOut;
          durationMs = event.duration_ms ?? durationMs;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return { text: resultText, session_id: sessionIdOut, duration_ms: durationMs };
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

    // Should NOT request payment for free job
    expect(text).not.toMatch(/โอน.*crypto|wallet.*address|payment.*require|ต้องโอน/i);

    // Should show job output or completion summary
    expect(text).toMatch(/hello world|เสร็จ|สำเร็จ|output|result|\[.*Z\]/i);
  }, 120000);

  // ─── JR-E2E-02: Paid job asks for payment + sends wallet address ───────────
  it('JR-E2E-02: /job-run test-paid ($5 job) greets user and requests crypto payment with wallet address', async () => {
    const { text, session_id } = await sendMessageSSE('/job-run test-paid');

    // Must mention the job or its cost
    expect(text).toMatch(/test-paid|\$5|5.*dollar|paid.*job/i);

    // Must request payment — wallet address is crucial
    expect(text).toMatch(/wallet|address|โอน|crypto|bnb|bep-20|0x[0-9a-fA-F]/i);

    // Must NOT have run the script before payment
    // Note: agent may mention "PAID JOB OK" in job description, but not the timestamped output
    expect(text).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] PAID JOB OK/);

    // Save session_id for follow-up test
    expect(session_id).toBeTruthy();
  }, 120000);

  // ─── JR-E2E-03a: "โอนแล้ว" (trust policy) → agent runs job ────────────────
  it('JR-E2E-03a: After /job-run test-paid, saying "โอนแล้ว" triggers job execution (trust policy)', async () => {
    // Turn 1: start job
    const turn1 = await sendMessageSSE('/job-run test-paid');
    expect(turn1.text).toMatch(/wallet|address|โอน|crypto|bnb|bep-20|0x[0-9a-fA-F]/i);

    // Turn 2: user claims they paid (trust policy — no tx hash needed)
    const turn2 = await sendMessageSSE('โอนแล้วครับ', turn1.session_id);

    // Agent should acknowledge payment and run the script
    expect(turn2.text).toMatch(/ขอบคุณ|thank|เริ่มงาน|start|ดำเนิน|received|โอเค/i);

    // Should contain PAID JOB OK from script execution
    expect(turn2.text).toContain('PAID JOB OK');
  }, 180000);

  // ─── JR-E2E-03b: tx hash → agent verifies via BscScan ────────────────────
  it('JR-E2E-03b: Sending fake tx hash causes agent to attempt BscScan verification and report result', async () => {
    const FAKE_TX = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';

    // Turn 1: start paid job
    const turn1 = await sendMessageSSE('/job-run test-paid');
    expect(turn1.text).toMatch(/wallet|address|โอน|crypto|bnb|bep-20|0x[0-9a-fA-F]/i);

    // Turn 2: send fake tx hash
    const turn2 = await sendMessageSSE(`โอนแล้วครับ tx: ${FAKE_TX}`, turn1.session_id);

    // Agent must acknowledge the tx hash (mention it or say "กำลังเช็ค" / "ตรวจสอบ")
    // It should either: verify failed → ask again, OR trust and run
    expect(turn2.text).toMatch(
      /0xdeadbeef|ตรวจสอบ|เช็ค|verify|bscscan|invalid|ไม่พบ|not found|ขอบคุณ|เริ่มงาน|PAID JOB OK/i,
    );

    // If agent couldn't verify (BscScan returned error), it should NOT silently ignore the hash
    // If agent trusted anyway (trust policy), script should have run
    const verifyFailed = !turn2.text.includes('PAID JOB OK');
    if (verifyFailed) {
      // Agent should report verification failed and ask user to confirm or retry
      expect(turn2.text).toMatch(/ไม่พบ|not found|invalid|error|ลองอีก|ยืนยัน|confirm|เชื่อ/i);

      // Turn 3: user confirms to proceed despite verification failure
      const turn3 = await sendMessageSSE('ยืนยันครับ โอนจริงๆ ครับ', turn2.session_id);
      expect(turn3.text).toMatch(/ขอบคุณ|เริ่มงาน|ดำเนิน|PAID JOB OK/i);
    }
  }, 240000);

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

  // ─── JR-E2E-07: Multi-turn paid job — full 3-turn flow ───────────────────
  it('JR-E2E-07: Multi-turn paid job — ask clarification, get wallet, pay, run (3+ turns)', async () => {
    // Turn 1: start paid job
    const turn1 = await sendMessageSSE('/job-run test-paid');

    // Must show job info + request payment
    expect(turn1.text).toMatch(/test-paid|\$5|paid.*job/i);
    expect(turn1.text).toMatch(/wallet|address|โอน|crypto|0x[0-9a-fA-F]/i);
    expect(turn1.session_id).toBeTruthy();

    // Turn 2: ask about what the job actually does before paying
    const turn2 = await sendMessageSSE('งานนี้ทำอะไรครับ ก่อนโอนขอรู้ก่อน', turn1.session_id);

    // Agent should explain the job without running it
    expect(turn2.text).toMatch(/test-paid|paid|ทดสอบ|e2e|payment|gate|script/i);
    expect(turn2.text).not.toContain('PAID JOB OK'); // must NOT run yet

    // Turn 3: user confirms payment
    const turn3 = await sendMessageSSE('โอนแล้วครับ', turn2.session_id);

    // Agent should run the job now
    expect(turn3.text).toMatch(/ขอบคุณ|เริ่มงาน|ดำเนิน|PAID JOB OK/i);
    expect(turn3.text).toContain('PAID JOB OK');
  }, 300000);
});
