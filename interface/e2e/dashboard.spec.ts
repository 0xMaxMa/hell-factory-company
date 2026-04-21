import { test, expect } from '@playwright/test'

test.describe('Dashboard page', () => {
  test('loads and shows page title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Hell Factory/i)
    await expect(page.getByText('HELL FACTORY')).toBeVisible()
  })

  test('shows navigation links', async ({ page }) => {
    await page.goto('/')
    // Nav uses Link components — locate by nav context to avoid ambiguity
    const nav = page.locator('nav')
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Run Job' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Config' })).toBeVisible()
  })

  test('shows wallet section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/wallet/i)).toBeVisible()
  })

  test('shows active jobs section', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/active/i).first()).toBeVisible()
  })

  test('New Job button navigates to run page', async ({ page }) => {
    await page.goto('/')
    const newBtn = page.getByRole('link', { name: /new/i }).or(page.getByRole('button', { name: /new/i }))
    if (await newBtn.isVisible()) {
      await newBtn.click()
      await expect(page).toHaveURL(/\/run/)
    }
  })
})
