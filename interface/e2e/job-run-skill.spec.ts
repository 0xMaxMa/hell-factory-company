/**
 * e2e tests for /job-run skill via Agent API
 *
 * NOTE: Gateway API channel injects "Do NOT call any tools" into every request.
 * This means the agent responds conversationally — it cannot run Bash/Skill tools.
 * Actual script execution is tested separately via direct CLI in the unit-style tests below.
 *
 * What these tests cover:
 *   1. Agent API reachability
 *   2. Job description + info when /job-run is invoked
 *   3. Free job ($0) → no payment request
 *   4. Unknown job → error + list
 *   5. /job-run without args → list jobs
 *   6. Direct script execution (no API, runs main.py directly via subprocess)
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { execSync } from 'child_process'

const GATEWAY_API = 'http://localhost:3000/api/v1/agents/indian-programmer/messages'
const API_KEY = 'hell-factory-api-key'
const JOB_WORKSPACE = '/home/dev/projects/hell-factory-company/job_workspaces'

const baseHeaders = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
}

async function sendMessage(
  request: ReturnType<typeof playwrightRequest.newContext> extends Promise<infer R> ? R : never,
  message: string,
  sessionId?: string,
): Promise<string> {
  const sid = sessionId ?? `job-run-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const res = await request.post(GATEWAY_API, {
    headers: baseHeaders,
    data: { message, session_id: sid, stream: false },
  })
  const body = await res.json()
  return body.content ?? body.message ?? body.response ?? JSON.stringify(body)
}

test.describe.configure({ mode: 'serial' })

test.describe('/job-run skill — Agent API (conversational)', () => {
  test('Gateway is reachable with valid API key', async ({ request }) => {
    const res = await request.post(GATEWAY_API, {
      headers: baseHeaders,
      data: { message: 'ping', session_id: `ping-${Date.now()}`, stream: false },
    })
    expect(res.status()).not.toBe(401)
    expect(res.status()).not.toBe(403)
    expect(res.ok()).toBe(true)
  })

  test('Agent responds to /job-run test-echo with job description', async ({ request }) => {
    const reply = await sendMessage(request, '/job-run test-echo')
    // Should mention the job name
    expect(reply.toLowerCase()).toMatch(/test.?echo/)
  })

  test('Free job ($0) — agent does not request crypto payment', async ({ request }) => {
    const reply = await sendMessage(request, '/job-run test-echo')
    // test-echo has initial_capital: "$0" — agent should NOT demand payment
    expect(reply).not.toMatch(/โอน crypto ก่อน|send.*crypto.*first|please pay.*before/i)
  })

  test('Unknown job returns helpful error', async ({ request }) => {
    const reply = await sendMessage(request, '/job-run nonexistent-job-xyz-abc')
    expect(reply.toLowerCase()).toMatch(/ไม่พบ|not found|no.*job|ไม่มี|available|list/i)
  })

  test('/job-run without args mentions available jobs', async ({ request }) => {
    const reply = await sendMessage(request, '/job-run')
    // Should mention some job names
    expect(reply.toLowerCase()).toMatch(/test.?echo|binance|teach|shopee|job/i)
  })
})

test.describe('/job-run — direct script execution (no API)', () => {
  test('test-echo main.py prints timestamp + Hello World', () => {
    const output = execSync(`python3 ${JOB_WORKSPACE}/test-echo/scripts/main.py`, {
      encoding: 'utf-8',
    }).trim()

    // Format: [2026-04-21T00:00:00Z] Hello World
    expect(output).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\] Hello World$/)
  })

  test('test-echo dry-run prints DRY-RUN prefix', () => {
    const output = execSync(`python3 ${JOB_WORKSPACE}/test-echo/scripts/main.py --dry-run`, {
      encoding: 'utf-8',
    }).trim()

    expect(output).toMatch(/^\[DRY-RUN\] Would print:/)
    expect(output).toContain('Hello World')
  })

  test('test-echo job.json has status ready and $0 cost', () => {
    const raw = execSync(`cat ${JOB_WORKSPACE}/test-echo/job.json`, { encoding: 'utf-8' })
    const job = JSON.parse(raw)

    expect(job.status).toBe('ready')
    expect(job.enabled).toBe(true)
    expect(job.estimated_earnings).toMatch(/\$0/)
    expect(job.requires.initial_capital).toMatch(/\$0/)
    expect(job.risk_level).toBe('low')
  })
})
