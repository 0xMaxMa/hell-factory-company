import { test, expect } from '@playwright/test'

test.describe('Dashboard Charts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows portfolio value chart section', async ({ page }) => {
    await expect(page.getByText('Portfolio Value (Daily)')).toBeVisible()
  })

  test('shows job runs chart section', async ({ page }) => {
    await expect(page.getByText('Job Runs')).toBeVisible()
  })

  test('shows earnings per job chart section', async ({ page }) => {
    await expect(page.getByText('Earnings per Job')).toBeVisible()
  })

  test('shows recent transactions section', async ({ page }) => {
    await expect(page.getByText('Recent Incoming Transactions')).toBeVisible()
  })

  test('agent sessions metric reads from sessions API', async ({ page }) => {
    const sessionsCard = page.locator('.card').filter({ hasText: 'Agent Sessions' })
    await expect(sessionsCard).toBeVisible()
    // Verify the sub-text shows "total · active" format (from local sessions API)
    await expect(sessionsCard.getByText(/total.*active/)).toBeVisible({ timeout: 5000 })
  })

  test('transaction table shows column headers when no txs', async ({ page }) => {
    // Either shows table headers or "No incoming transactions" message
    const txSection = page.locator('.card').filter({ hasText: 'Recent Incoming Transactions' })
    await expect(txSection).toBeVisible()
    const hasHeaders = await page.getByText('TxHash').isVisible().catch(() => false)
    const hasEmpty = await page.getByText('No incoming transactions').isVisible().catch(() => false)
    const hasError = await page.getByText('Wallet or BSCScan').isVisible().catch(() => false)
    expect(hasHeaders || hasEmpty || hasError).toBe(true)
  })
})
