import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('login and inspect full dashboard', async ({ page }) => {
  await login(page)

  // Wait for dashboard to fully load (wait for loading to disappear)
  await page.waitForTimeout(5000)

  // Screenshot full page
  await page.screenshot({ path: 'e2e/screenshots/dashboard-full.png', fullPage: true })

  // Get full page text
  const bodyText = await page.locator('body').innerText()
  console.log('=== FULL DASHBOARD TEXT ===')
  console.log(bodyText)
  console.log('=== END ===')

  // Check sidebar navigation items
  const sidebar = await page.locator('nav').first().innerText()
  console.log('=== SIDEBAR ===')
  console.log(sidebar)
  console.log('=== END SIDEBAR ===')

  // Count visible cards/widgets
  const cards = page.locator('[class*="card"]')
  const cardCount = await cards.count()
  console.log('Number of card elements:', cardCount)

  // Screenshot viewport only
  await page.screenshot({ path: 'e2e/screenshots/dashboard-viewport.png' })
})
