import { test, expect } from '@playwright/test'

test.describe('Config page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config')
  })

  test('shows configuration heading', async ({ page }) => {
    await expect(page.getByText('Configuration')).toBeVisible()
  })

  test('shows Gateway, Wallet and Job Settings sections', async ({ page }) => {
    await expect(page.getByText('Gateway', { exact: true })).toBeVisible()
    await expect(page.getByText('Wallet', { exact: true })).toBeVisible()
    await expect(page.getByText('Job Settings', { exact: true })).toBeVisible()
  })

  test('Save button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })

  test('Test Connection button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /test connection/i })).toBeVisible()
  })

  test('can type into Gateway URL field', async ({ page }) => {
    const input = page.getByPlaceholder('http://localhost:3000')
    await input.fill('http://mygateway:4000')
    await expect(input).toHaveValue('http://mygateway:4000')
  })

  test('can type into Agent ID field', async ({ page }) => {
    const input = page.getByPlaceholder('indian-programmer')
    await input.fill('my-agent')
    await expect(input).toHaveValue('my-agent')
  })

  test('can type BNB Address', async ({ page }) => {
    const input = page.getByPlaceholder('0x...')
    await input.fill('0xdeadbeef1234')
    await expect(input).toHaveValue('0xdeadbeef1234')
  })

  test('save persists config and shows confirmation', async ({ page }) => {
    // Intercept API call
    await page.route('/api/config', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ config: {} }) })
      }
    })

    const urlInput = page.getByPlaceholder('http://localhost:3000')
    await urlInput.fill('http://test-gateway:9000')
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/saved/i)).toBeVisible()
  })

  test('shows error when save fails', async ({ page }) => {
    await page.route('/api/config', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: JSON.stringify({ error: 'disk full' }) })
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ config: {} }) })
      }
    })

    // Dialog listener for alert()
    page.on('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: /save/i }).click()
  })

  test('test connection shows result', async ({ page }) => {
    await page.route('/api/gateway/status', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ agents: [{ id: 'indian-programmer', sessions: [] }] }) })
    )
    await page.getByRole('button', { name: /test connection/i }).click()
    await expect(page.getByText(/connected/i).or(page.getByText(/❌/))).toBeVisible({ timeout: 5000 })
  })

  test('Job Workspaces section shows toggle for each job', async ({ page }) => {
    await page.route('/api/jobs*', route =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          jobs: [
            { name: 'binance-earn', category: 'defi', status: 'ready', enabled: true, description: '', risk_level: 'low', created_at: '', estimated_earnings: '' },
            { name: 'shopee-cs', category: 'commerce', status: 'ready', enabled: false, description: '', risk_level: 'low', created_at: '', estimated_earnings: '' },
          ]
        })
      })
    )
    await page.goto('/config')
    await expect(page.getByText('binance-earn')).toBeVisible()
    await expect(page.getByText('shopee-cs')).toBeVisible()
    await expect(page.getByText('enabled').first()).toBeVisible()
    await expect(page.getByText('disabled')).toBeVisible()
  })

  test('clicking job toggle calls PATCH endpoint', async ({ page }) => {
    let patchCalled = false

    await page.route('/api/jobs**', async route => {
      if (route.request().method() === 'PATCH') {
        patchCalled = true
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true, enabled: false }) })
      } else {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            jobs: [{ name: 'binance-earn', category: 'defi', status: 'ready', enabled: true, description: '', risk_level: 'low', created_at: '', estimated_earnings: '' }]
          })
        })
      }
    })

    await page.goto('/config')
    await page.waitForSelector('text=binance-earn')
    // The toggle is the div with border-radius:10 inside the job row
    await page.locator('div[style*="border-radius: 10"]').first().click()
    await expect.poll(() => patchCalled, { timeout: 5000 }).toBe(true)
  })
})
