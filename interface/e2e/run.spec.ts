import { test, expect } from '@playwright/test'

const mockJobs = [
  { name: 'binance-earn', category: 'defi', status: 'ready', enabled: true, description: 'Earn on Binance', risk_level: 'low', created_at: '2026-01-01', estimated_earnings: '$10/d' },
  { name: 'test-echo', category: 'automation', status: 'ready', enabled: true, description: 'Echo test job', risk_level: 'low', created_at: '2026-01-01', estimated_earnings: '$0 (test only)' },
]

const mockSession = {
  id: 'job-test-echo-1234567890',
  jobName: 'test-echo',
  status: 'idle',
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  messageCount: 0,
}

test.describe('Run Job wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/jobs**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ jobs: mockJobs }) })
    )
    await page.route('/api/sessions', route => {
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
      return route.fulfill({ status: 201, body: JSON.stringify({ session: mockSession }) })
    })
    await page.route('/api/sessions/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
    )
    await page.goto('/run')
  })

  test('shows Run Job page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Run Job' }).or(page.getByText('Run Job').first())).toBeVisible()
  })

  test('Step 1 shows job cards from API', async ({ page }) => {
    await expect(page.getByText('Select Job Workspace')).toBeVisible()
    await expect(page.getByTestId('job-card-binance-earn')).toBeVisible()
    await expect(page.getByTestId('job-card-test-echo')).toBeVisible()
  })

  test('clicking job card shows Step 2 session picker', async ({ page }) => {
    await page.getByTestId('job-card-test-echo').click()
    await expect(page.getByText('Session', { exact: true })).toBeVisible()
    await expect(page.getByTestId('start-session-btn')).toBeVisible()
  })

  test('Step 2 shows New Session option', async ({ page }) => {
    await page.getByTestId('job-card-test-echo').click()
    await expect(page.getByText('New Session')).toBeVisible()
  })

  test('clicking Start in Step 2 calls POST /api/sessions and shows terminal', async ({ page }) => {
    let sessionCreated = false
    await page.route('/api/sessions', route => {
      if (route.request().method() === 'POST') {
        sessionCreated = true
        return route.fulfill({ status: 201, body: JSON.stringify({ session: mockSession }) })
      }
      return route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
    })

    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await expect.poll(() => sessionCreated, { timeout: 5000 }).toBe(true)
    await expect(page.getByTestId('step-terminal')).toBeVisible()
  })

  test('terminal shows step-terminal container', async ({ page }) => {
    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await expect(page.getByTestId('step-terminal')).toBeVisible({ timeout: 5000 })
  })

  test('chat input visible in Step 3', async ({ page }) => {
    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await expect(page.getByTestId('chat-input')).toBeVisible()
  })

  test('Back button from Step 3 returns to wizard', async ({ page }) => {
    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await page.getByTestId('back-to-wizard').click()
    await expect(page.getByTestId('step-session-picker')).toBeVisible()
  })

  test('Run Job button calls gateway messages API', async ({ page }) => {
    let gatewayCalled = false
    await page.route('/api/gateway/messages', async route => {
      gatewayCalled = true
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: 'data: {"type":"text","text":"Starting..."}\n\ndata: [DONE]\n\n',
      })
    })
    await page.route('/api/sessions/**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ session: { ...mockSession, status: 'active' } }) })
    )

    await page.getByTestId('job-card-test-echo').click()
    await page.getByTestId('start-session-btn').click()
    await page.getByRole('button', { name: /▶ Run Job/ }).click()
    await expect.poll(() => gatewayCalled, { timeout: 5000 }).toBe(true)
  })

  test('switching job in Step 1 resets to Step 1 selection', async ({ page }) => {
    await page.getByTestId('job-card-test-echo').click()
    await expect(page.getByTestId('step-session-picker')).toBeVisible()
    await page.getByTestId('job-card-binance-earn').click()
    // Should still show session picker (now for binance-earn)
    await expect(page.getByTestId('step-session-picker')).toBeVisible()
  })
})

test.describe('Active Sessions Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/jobs**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ jobs: mockJobs }) })
    )
  })

  test('hides table when no sessions exist', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [] }) })
    )
    await page.goto('/run')
    await expect(page.getByText('Active Sessions')).not.toBeVisible()
  })

  test('shows session table when sessions exist', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [mockSession] }) })
    )
    await page.goto('/run')
    await expect(page.getByText('Active Sessions')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'test-echo' })).toBeVisible()
  })

  test('shows Resume button for sessions', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [mockSession] }) })
    )
    await page.goto('/run')
    await expect(page.getByTestId(`resume-${mockSession.id}`)).toBeVisible()
  })

  test('shows Delete button for idle session', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [mockSession] }) })
    )
    await page.goto('/run')
    await expect(page.getByTestId(`delete-${mockSession.id}`)).toBeVisible()
  })

  test('clicking Resume opens terminal for that session', async ({ page }) => {
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [mockSession] }) })
    )
    await page.goto('/run')
    await page.getByTestId(`resume-${mockSession.id}`).click()
    await expect(page.getByTestId('step-terminal')).toBeVisible()
    await expect(page.getByText(mockSession.id)).toBeVisible()
  })

  test('clicking Delete calls DELETE /api/sessions/[id]', async ({ page }) => {
    let deleteCalled = false
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [mockSession] }) })
    )
    await page.route(`/api/sessions/${mockSession.id}`, route => {
      if (route.request().method() === 'DELETE') deleteCalled = true
      return route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
    })
    await page.goto('/run')
    await page.getByTestId(`delete-${mockSession.id}`).click()
    await expect.poll(() => deleteCalled, { timeout: 5000 }).toBe(true)
  })

  test('active session shows Stop button not Delete', async ({ page }) => {
    const activeSession = { ...mockSession, status: 'active' }
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [activeSession] }) })
    )
    await page.goto('/run')
    await expect(page.getByTestId(`stop-${mockSession.id}`)).toBeVisible()
    await expect(page.getByTestId(`delete-${mockSession.id}`)).not.toBeVisible()
  })
})

test.describe('Step 2: Session Picker with existing sessions', () => {
  test('shows Resume option when sessions exist for job', async ({ page }) => {
    const existingSession = { ...mockSession, status: 'idle' }
    await page.route('/api/jobs**', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ jobs: mockJobs }) })
    )
    await page.route('/api/sessions', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ sessions: [existingSession] }) })
    )
    await page.goto('/run')
    await page.getByTestId('job-card-test-echo').click()
    await expect(page.getByText('Resume existing session')).toBeVisible()
    await expect(page.getByTestId('session-select')).toBeVisible()
  })
})
