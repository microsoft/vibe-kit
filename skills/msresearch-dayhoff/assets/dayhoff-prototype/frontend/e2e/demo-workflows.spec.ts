import { test, expect } from '@playwright/test'

/**
 * E3: smoke test that the 4 demo workflows render cached results without
 * hitting the live AML endpoint. Each preset is exercised end-to-end:
 *   1. Page loads
 *   2. Demo chip is clickable
 *   3. Cached result renders with the "Cached" badge
 *
 * Run with: npm run e2e
 */

const DEMOS = [
  { key: 'cas9', label: /Cas9/i },
  { key: 'insulin', label: /insulin/i },
  { key: 'dnapol', label: /DNA polymerase/i },
  { key: 'spike', label: /Spike/i },
] as const

test.describe('Dayhoff demo workflows (cached)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Dismiss the auto-tour if it pops up on first load.
    await page.evaluate(() => localStorage.setItem('dayhoff-tour-done', '1'))
    await page.reload()
  })

  for (const demo of DEMOS) {
    test(`${demo.key}: cached result renders`, async ({ page }) => {
      // Demo chips live in the left rail. Click by accessible label.
      const chip = page.getByRole('button', { name: demo.label }).first()
      await expect(chip).toBeVisible({ timeout: 10_000 })
      await chip.click()

      // Trigger generation (which should hit the precomputed cache).
      const generate = page.getByRole('button', { name: /generate/i }).first()
      await expect(generate).toBeVisible()
      await generate.click()

      // Cached badge confirms we did not call the live AML endpoint.
      const cachedBadge = page.getByText(/Cached \(v7/i).first()
      await expect(cachedBadge).toBeVisible({ timeout: 5_000 })
    })
  }

  test('header shows Live or Demo badge', async ({ page }) => {
    const badge = page.locator('.app-header__badge--demo').first()
    await expect(badge).toBeVisible()
  })
})
