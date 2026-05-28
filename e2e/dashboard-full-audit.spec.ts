import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Dashboard Full Audit', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForTimeout(3000)
  })

  test('01 - Full page screenshot (scrolled)', async ({ page }) => {
    // Wait for all content to load
    await page.waitForTimeout(5000)

    // Full page screenshot
    await page.screenshot({
      path: 'e2e/screenshots/01-dashboard-fullpage.png',
      fullPage: true,
    })

    // Viewport-only screenshot (above the fold)
    await page.screenshot({
      path: 'e2e/screenshots/01-dashboard-above-fold.png',
    })

    // Scroll to middle and screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3))
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'e2e/screenshots/01-dashboard-middle.png',
    })

    // Scroll to bottom and screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    await page.screenshot({
      path: 'e2e/screenshots/01-dashboard-bottom.png',
    })

    // Measure page dimensions
    const dimensions = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
      scrollWidth: document.body.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }))
    console.log('=== PAGE DIMENSIONS ===')
    console.log(JSON.stringify(dimensions, null, 2))
  })

  test('02 - Sidebar interaction', async ({ page }) => {
    // Screenshot sidebar
    const sidebar = page.locator('aside').first()
    if (await sidebar.isVisible()) {
      await sidebar.screenshot({ path: 'e2e/screenshots/02-sidebar.png' })
      const sidebarText = await sidebar.innerText()
      console.log('=== SIDEBAR CONTENT ===')
      console.log(sidebarText)
    }

    // Check all nav links
    const navLinks = page.locator('nav a, aside a')
    const linkCount = await navLinks.count()
    console.log('=== NAV LINKS ===')
    for (let i = 0; i < linkCount; i++) {
      const href = await navLinks.nth(i).getAttribute('href')
      const text = await navLinks.nth(i).innerText()
      console.log(`Link ${i}: "${text.trim()}" -> ${href}`)
    }

    // Check dark mode toggle
    const darkToggle = page.locator('text=Switch to Dark Panel').first()
    if (await darkToggle.isVisible()) {
      console.log('Dark mode toggle: VISIBLE')
      await darkToggle.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'e2e/screenshots/02-sidebar-dark-mode.png' })

      // Toggle back
      const lightToggle = page.locator('text=Switch to Light Panel').first()
      if (await lightToggle.isVisible()) {
        await lightToggle.click()
        await page.waitForTimeout(500)
      }
    }
  })

  test('03 - KPI cards analysis', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Get all text from the KPI area (top section)
    const bodyText = await page.locator('body').innerText()

    // Extract KPI data
    const kpis = [
      'Total Leads', 'Won Revenue', 'Deal Win Rate',
      'Lead Conversion', 'Avg Deal Size'
    ]
    console.log('=== KPI CARDS ===')
    for (const kpi of kpis) {
      const idx = bodyText.indexOf(kpi)
      if (idx >= 0) {
        const snippet = bodyText.substring(idx, idx + 100)
        console.log(`${kpi}: ${snippet.split('\n').slice(0, 3).join(' | ')}`)
      }
    }
  })

  test('04 - Time filter tabs', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Find and test time filter tabs
    const tabs = ['This Month', 'This Quarter', 'This Year', 'All Time']

    for (const tab of tabs) {
      const tabEl = page.locator(`text="${tab}"`).first()
      if (await tabEl.isVisible()) {
        await tabEl.click()
        await page.waitForTimeout(2000)
        await page.screenshot({
          path: `e2e/screenshots/04-filter-${tab.toLowerCase().replace(/\s/g, '-')}.png`,
          fullPage: true,
        })

        // Get KPI values after filter change
        const bodyText = await page.locator('body').innerText()
        const totalLeadsMatch = bodyText.match(/Total Leads\n(\d+)/)
        const wonRevenueMatch = bodyText.match(/Won Revenue\n(Rp[\s\S]*?)(?:\n|▼|▲)/)
        console.log(`=== ${tab.toUpperCase()} ===`)
        console.log(`Total Leads: ${totalLeadsMatch?.[1] || 'N/A'}`)
        console.log(`Won Revenue: ${wonRevenueMatch?.[1]?.trim() || 'N/A'}`)
      }
    }
  })

  test('05 - Pipeline stages widget', async ({ page }) => {
    await page.waitForTimeout(2000)

    const bodyText = await page.locator('body').innerText()
    const pipelineSection = bodyText.substring(
      bodyText.indexOf('Pipeline Stages'),
      bodyText.indexOf('Sales Performance')
    )
    console.log('=== PIPELINE STAGES ===')
    console.log(pipelineSection)
  })

  test('06 - Sales performance widget', async ({ page }) => {
    await page.waitForTimeout(2000)

    const bodyText = await page.locator('body').innerText()
    const salesStart = bodyText.indexOf('Sales Performance vs Target')
    const salesEnd = bodyText.indexOf('Top Revenue Generators')
    if (salesStart >= 0 && salesEnd >= 0) {
      console.log('=== SALES PERFORMANCE ===')
      console.log(bodyText.substring(salesStart, salesEnd))
    }
  })

  test('07 - Lead source & classification widgets', async ({ page }) => {
    await page.waitForTimeout(2000)

    const bodyText = await page.locator('body').innerText()

    // Lead Source
    const sourceStart = bodyText.indexOf('Lead Source')
    const sourceEnd = bodyText.indexOf('Lead Classification')
    if (sourceStart >= 0 && sourceEnd >= 0) {
      console.log('=== LEAD SOURCE ===')
      console.log(bodyText.substring(sourceStart, sourceEnd))
    }

    // Lead Classification - check tabs
    const classificationTabs = ['Category', 'Grade', 'Lead Source', 'Biz Purpose', 'Sector']
    console.log('=== CLASSIFICATION TABS ===')
    for (const tab of classificationTabs) {
      const tabEl = page.locator(`text="${tab}"`).first()
      if (await tabEl.isVisible()) {
        await tabEl.click()
        await page.waitForTimeout(1000)
        console.log(`Tab "${tab}": clicked successfully`)
      }
    }

    // Stream Alignment tabs
    const streamTabs = ['All', 'Sub Stream', 'Biz Purpose', 'Line Industry', 'Area', 'Nationality']
    console.log('=== STREAM ALIGNMENT TABS ===')
    for (const tab of streamTabs) {
      const tabEls = page.locator(`text="${tab}"`)
      const count = await tabEls.count()
      if (count > 0) {
        // Click the last one (stream section is lower)
        await tabEls.last().click()
        await page.waitForTimeout(1000)
        console.log(`Stream tab "${tab}": clicked successfully`)
      }
    }
  })

  test('08 - Goal attainment & forecast section', async ({ page }) => {
    await page.waitForTimeout(2000)

    // Scroll to goal section
    const goalSection = page.locator('text=Goal Attainment').first()
    if (await goalSection.isVisible()) {
      await goalSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'e2e/screenshots/08-goal-section.png' })
    }

    const bodyText = await page.locator('body').innerText()
    const goalStart = bodyText.indexOf('Goal Attainment')
    const goalEnd = bodyText.indexOf('Historical Trend')
    if (goalStart >= 0) {
      console.log('=== GOAL & FORECAST SECTION ===')
      console.log(bodyText.substring(goalStart, goalEnd > 0 ? goalEnd + 200 : goalStart + 1000))
    }
  })

  test('09 - Edit Dashboard button', async ({ page }) => {
    await page.waitForTimeout(2000)

    const editBtn = page.locator('text=Edit Dashboard').first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'e2e/screenshots/09-edit-dashboard-mode.png', fullPage: true })

      const bodyText = await page.locator('body').innerText()
      console.log('=== EDIT MODE ===')
      console.log(bodyText.substring(0, 2000))
    }
  })

  test('10 - Responsive check (mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'e2e/screenshots/10-mobile-viewport.png',
      fullPage: true,
    })

    const bodyText = await page.locator('body').innerText()
    console.log('=== MOBILE VIEW ===')
    console.log(bodyText.substring(0, 2000))
  })

  test('11 - Responsive check (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(2000)
    await page.screenshot({
      path: 'e2e/screenshots/11-tablet-viewport.png',
      fullPage: true,
    })
  })

  test('12 - Chart hover interactions', async ({ page }) => {
    await page.waitForTimeout(3000)

    // Try hovering on the Monthly Revenue chart area
    const chartArea = page.locator('text=Monthly Revenue vs Target').first()
    if (await chartArea.isVisible()) {
      await chartArea.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)

      // Hover over chart area (approximate position)
      const box = await chartArea.boundingBox()
      if (box) {
        // Hover below the title where the chart should be
        await page.mouse.move(box.x + 200, box.y + 150)
        await page.waitForTimeout(1000)
        await page.screenshot({ path: 'e2e/screenshots/12-chart-hover.png' })
      }
    }
  })
})
