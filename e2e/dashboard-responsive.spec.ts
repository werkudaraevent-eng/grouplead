import { test, expect } from '@playwright/test'
import { getE2ECredentials, login } from './helpers'

test.describe('Dashboard Responsive & Extra Tests', () => {

  test('01 - Mobile responsive (375px)', async ({ page }) => {
    // Set mobile viewport BEFORE navigating
    await page.setViewportSize({ width: 375, height: 812 })

    // Login at mobile size
    await page.goto('/login')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'e2e/screenshots/resp-mobile-login.png' })

    await login(page)
    await page.waitForTimeout(5000)

    await page.screenshot({ path: 'e2e/screenshots/resp-mobile-dashboard.png', fullPage: true })

    // Check if sidebar is visible or collapsed
    const sidebar = page.locator('aside').first()
    const sidebarVisible = await sidebar.isVisible()
    console.log('Sidebar visible on mobile:', sidebarVisible)

    // Get body text
    const bodyText = await page.locator('body').innerText()
    console.log('=== MOBILE DASHBOARD ===')
    console.log(bodyText.substring(0, 1500))

    // Check for horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth
    })
    console.log('Horizontal overflow on mobile:', overflow)
  })

  test('02 - Tablet responsive (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })

    await login(page)
    await page.waitForTimeout(5000)

    await page.screenshot({ path: 'e2e/screenshots/resp-tablet-dashboard.png', fullPage: true })

    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth
    })
    console.log('Horizontal overflow on tablet:', overflow)
  })

  test('03 - Classification widget deep dive', async ({ page }) => {
    await login(page)
    await page.waitForTimeout(3000)

    // Scroll to Lead Classification section
    const classSection = page.locator('text=Lead Classification').first()
    await classSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'e2e/screenshots/classification-section.png' })

    // Check what type of elements the classification tabs are
    const classArea = page.locator('text=Lead Classification').first()
    const parent = classArea.locator('..')
    const parentHTML = await parent.innerHTML()
    console.log('=== CLASSIFICATION WIDGET HTML (first 2000 chars) ===')
    console.log(parentHTML.substring(0, 2000))

    // Scroll to Stream Alignment
    const streamSection = page.locator('text=Stream Alignment').first()
    if (await streamSection.isVisible()) {
      await streamSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'e2e/screenshots/stream-alignment-section.png' })

      // Check select elements
      const selects = page.locator('select')
      const selectCount = await selects.count()
      console.log('Number of <select> elements:', selectCount)
      for (let i = 0; i < selectCount; i++) {
        const options = await selects.nth(i).locator('option').allInnerTexts()
        console.log(`Select ${i} options:`, options)
      }
    }
  })

  test('04 - Loading states and empty states', async ({ page }) => {
    await login(page)

    // Check immediately for loading states
    const loadingElements = page.locator('text=Loading')
    const loadingCount = await loadingElements.count()
    console.log('Loading elements visible immediately:', loadingCount)

    await page.waitForTimeout(5000)

    // Check for "No data" or empty states
    const bodyText = await page.locator('body').innerText()
    const emptyPatterns = ['No data', 'No comparison', 'No breakdown', 'No segment', 'Target not set', 'Loading']
    console.log('=== EMPTY/LOADING STATES ===')
    for (const pattern of emptyPatterns) {
      const count = (bodyText.match(new RegExp(pattern, 'gi')) || []).length
      if (count > 0) {
        console.log(`"${pattern}": found ${count} times`)
      }
    }
  })

  test('05 - Page performance metrics', async ({ page }) => {
    await page.goto('/login')
    const { email, password } = getE2ECredentials()
    await page.fill('#email', email)
    await page.fill('#password', password)

    const startTime = Date.now()
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15000 })
    const navTime = Date.now() - startTime
    console.log(`Login -> Dashboard navigation: ${navTime}ms`)

    // Wait for full load
    await page.waitForTimeout(5000)
    const fullLoadTime = Date.now() - startTime
    console.log(`Full dashboard load time: ${fullLoadTime}ms`)

    // Count total DOM elements
    const domCount = await page.evaluate(() => document.querySelectorAll('*').length)
    console.log(`Total DOM elements: ${domCount}`)

    // Check for images
    const imgCount = await page.locator('img').count()
    const svgCount = await page.locator('svg').count()
    console.log(`Images: ${imgCount}, SVGs: ${svgCount}`)

    // Check for accessibility basics
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count()
    const buttons = await page.locator('button').count()
    const links = await page.locator('a').count()
    const ariaLabels = await page.evaluate(() =>
      document.querySelectorAll('[aria-label]').length
    )
    console.log(`Headings: ${headings}, Buttons: ${buttons}, Links: ${links}`)
    console.log(`Elements with aria-label: ${ariaLabels}`)

    // Check color contrast issues (basic check)
    const smallText = await page.evaluate(() => {
      const elements = document.querySelectorAll('*')
      let tinyCount = 0
      elements.forEach(el => {
        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)
        if (fontSize > 0 && fontSize < 12) tinyCount++
      })
      return tinyCount
    })
    console.log(`Elements with font-size < 12px: ${smallText}`)
  })
})
