import { test, expect } from '@playwright/test'

const mockSession = {
  id: 'job-test-echo-9999999999',
  jobName: 'test-echo',
  status: 'idle',
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  messageCount: 0,
}

// Run serially to avoid toggle test interfering with others
test.describe.configure({ mode: 'serial' })

test.describe('test-echo job', () => {
  // Ensure test-echo is enabled before each test
  test.beforeEach(async ({ request }) => {
    await request.fetch('/api/jobs/test-echo/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ enabled: true }),
    })
  })

  test('job appears in the Run Job list', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
    )
    await page.goto('/run')
    await expect(page.getByTestId('job-card-test-echo')).toBeVisible({ timeout: 10000 })
  })

  test('job card shows category and risk level', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
    )
    await page.goto('/run')
    const card = page.getByTestId('job-card-test-echo')
    await expect(card).toBeVisible()
    await expect(card.getByText('automation')).toBeVisible()
  })

  test('GET /api/jobs/test-echo returns correct job data', async ({ request }) => {
    const res = await request.get('/api/jobs/test-echo')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.job.name).toBe('test-echo')
    expect(body.job.category).toBe('automation')
    expect(body.job.status).toBe('ready')
    expect(body.job.risk_level).toBe('low')
    expect(body.job.tags).toContain('test')
  })

  test('GET /api/jobs/test-echo/runbook returns RUNBOOK content', async ({ request }) => {
    const res = await request.get('/api/jobs/test-echo/runbook')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.content).toContain('Hello World')
    expect(body.content).toContain('setup.sh')
    expect(body.content).toContain('main.py')
  })

  test('job is enabled and appears in default job list', async ({ request }) => {
    const res = await request.get('/api/jobs')
    const body = await res.json()
    const job = body.jobs.find((j: { name: string }) => j.name === 'test-echo')
    expect(job).toBeDefined()
    expect(job.enabled).not.toBe(false)
  })

  test('Run Job wizard sends correct message to gateway', async ({ page }) => {
    let capturedBody: Record<string, unknown> = {}

    await page.route('/api/sessions', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
      return route.fulfill({ status: 201, body: JSON.stringify({ session: mockSession }) })
    })
    await page.route('/api/sessions/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ session: { ...mockSession, status: 'active' } }) })
    )
    await page.route('/api/gateway/messages', async route => {
      capturedBody = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"starting..."}\n\ndata: [DONE]\n\n',
      })
    })

    await page.goto('/run')
    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await page.getByRole('button', { name: /▶ Run Job/ }).click()

    await expect.poll(() => capturedBody.message, { timeout: 8000 }).toContain('test-echo')
    expect(capturedBody.stream).toBe(true)
    expect(String(capturedBody.session_id)).toMatch(/^job-test-echo-/)
  })

  test('agent terminal shows streamed Hello World output', async ({ page }) => {
    await page.route('/api/sessions', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
      return route.fulfill({ status: 201, body: JSON.stringify({ session: mockSession }) })
    })
    await page.route('/api/sessions/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ session: mockSession }) })
    )
    await page.route('/api/gateway/messages', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: {"content":"[setup] test-echo environment ready."}\n\n',
          'data: {"content":"[2026-04-20T14:00:00Z] Hello World"}\n\n',
          'data: [DONE]\n\n',
        ].join(''),
      })
    })

    await page.goto('/run')
    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await page.getByRole('button', { name: /▶ Run Job/ }).click()

    const terminal = page.getByTestId('agent-terminal')
    await expect(terminal).toContainText('test-echo environment ready', { timeout: 8000 })
    await expect(terminal).toContainText('Hello World', { timeout: 8000 })
  })

  test('Stop button appears while agent is streaming', async ({ page }) => {
    await page.route('/api/sessions', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
      return route.fulfill({ status: 201, body: JSON.stringify({ session: mockSession }) })
    })
    await page.route('/api/sessions/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ session: mockSession }) })
    )
    await page.route('/api/gateway/messages', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"content":"running test-echo..."}\n\ndata: [DONE]\n\n',
      })
    })

    await page.goto('/run')
    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await page.getByRole('button', { name: /▶ Run Job/ }).click()
    await expect(page.getByRole('button', { name: /■ Stop/ })).toBeVisible({ timeout: 5000 })
  })

  test('toggle test-echo disable then re-enable', async ({ request }) => {
    // Disable
    let res = await request.fetch('/api/jobs/test-echo/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ enabled: false }),
    })
    let body = await res.json()
    expect(body.enabled).toBe(false)

    // Confirm job hidden from default list
    const listRes = await request.get('/api/jobs')
    const listBody = await listRes.json()
    const hidden = listBody.jobs.find((j: { name: string }) => j.name === 'test-echo')
    expect(hidden).toBeUndefined()

    // Re-enable
    res = await request.fetch('/api/jobs/test-echo/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ enabled: true }),
    })
    body = await res.json()
    expect(body.enabled).toBe(true)
  })

  test('disabled test-echo does not appear in Run Job list', async ({ page, request }) => {
    await request.fetch('/api/jobs/test-echo/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ enabled: false }),
    })
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
    )

    await page.goto('/run')
    await expect(page.getByTestId('job-card-test-echo')).not.toBeVisible()

    // Re-enable after test
    await request.fetch('/api/jobs/test-echo/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ enabled: true }),
    })
  })
})
