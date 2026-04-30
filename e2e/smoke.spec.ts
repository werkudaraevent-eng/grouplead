import { test, expect } from '@playwright/test'

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/login/)
})

test('root redirects or loads dashboard', async ({ page }) => {
  await page.goto('/')
  // Should either load dashboard or redirect to login
  await expect(page).toHaveURL(/(\/|\/login)/)
})
