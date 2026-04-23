import { test, expect } from '@playwright/test'

test.describe('Config Page — Wallet Cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/config')
  })

  test('does not have a standalone Wallet section card', async ({ page }) => {
    // There should be no card with exactly "Wallet" as its header (bnbAddress input removed)
    const walletInput = page.getByPlaceholder('0x...')
    await expect(walletInput).not.toBeAttached()
  })

  test('shows Analytics section with BSCScan API Key field', async ({ page }) => {
    await expect(page.getByText('Analytics')).toBeVisible()
    await expect(page.getByText('BSCScan API Key')).toBeVisible()
  })

  test('shows Gateway section with Agent ID field', async ({ page }) => {
    const gatewayCard = page.locator('.card').filter({ hasText: 'Gateway' }).first()
    await expect(gatewayCard).toBeVisible()
    await expect(page.getByText('Agent ID')).toBeVisible()
  })

  test('no BNB Address input field', async ({ page }) => {
    const bnbInput = page.getByPlaceholder('0x...')
    await expect(bnbInput).not.toBeAttached()
  })

  test('save button still works on Analytics section', async ({ page }) => {
    await page.route('/api/config', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ config: {} }) })
      }
    })
    const saveBtn = page.getByRole('button', { name: /Save/ })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 3000 })
  })
})
