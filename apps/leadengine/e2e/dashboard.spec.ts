import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('login and check dashboard', async ({ page }) => {
  await login(page)
  await expect(page.locator('text=Werkudara LeadEngine')).toBeVisible()

  // Take screenshot of dashboard
  await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true })

  // Basic checks - page loaded successfully
  await expect(page).toHaveURL('/')

  // Log page title
  const title = await page.title()
  console.log('Page title:', title)

  // Log visible text content for analysis
  const bodyText = await page.locator('body').innerText()
  console.log('--- DASHBOARD CONTENT ---')
  console.log(bodyText.substring(0, 3000))
  console.log('--- END ---')
})
