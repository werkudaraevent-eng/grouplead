import type { Page } from '@playwright/test'

export function getE2ECredentials() {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  if (!email || !password) {
    throw new Error('Missing E2E_EMAIL or E2E_PASSWORD. Set them in .env.test or shell environment.')
  }

  return { email, password }
}

export async function login(page: Page) {
  const { email, password } = getE2ECredentials()

  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}
