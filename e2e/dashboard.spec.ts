import { test, expect } from '@playwright/test'

test('login and check dashboard', async ({ page }) => {
  // Go to login page
  await page.goto('/login')
  await expect(page.locator('text=Werkudara LeadEngine')).toBeVisible()

  // Fill login form
  await page.fill('#email', 'hanungsastria13@gmail.com')
  await page.fill('#password', 'sayalupa')

  // Click Sign In
  await page.click('button[type="submit"]')

  // Wait for navigation to dashboard (root /)
  await page.waitForURL('/', { timeout: 15000 })

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
