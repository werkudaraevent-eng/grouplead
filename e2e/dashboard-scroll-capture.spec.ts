import { test, expect } from '@playwright/test'

test('Capture full dashboard with extended viewport', async ({ page }) => {
  // Use a very tall viewport to force all content visible without scroll
  await page.setViewportSize({ width: 1280, height: 8000 })

  await page.goto('/login')
  await page.fill('#email', 'hanungsastria13@gmail.com')
  await page.fill('#password', 'sayalupa')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await page.waitForTimeout(5000)

  // Full page screenshot with tall viewport
  await page.screenshot({
    path: 'e2e/screenshots/full-dashboard-tall.png',
    fullPage: true,
  })

  // Measure actual content dimensions
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('[class*="main"]')
    const scrollContainer = document.querySelector('[style*="overflow"]') || document.querySelector('[class*="overflow"]')
    return {
      bodyScrollHeight: document.body.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      mainScrollHeight: main?.scrollHeight || 0,
      scrollContainerHeight: scrollContainer?.scrollHeight || 0,
      scrollContainerTag: scrollContainer?.tagName || 'none',
    }
  })
  console.log('=== DIMENSIONS WITH TALL VIEWPORT ===')
  console.log(JSON.stringify(dims, null, 2))
})

test('Capture dashboard sections via scrollable container', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })

  await page.goto('/login')
  await page.fill('#email', 'hanungsastria13@gmail.com')
  await page.fill('#password', 'sayalupa')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await page.waitForTimeout(5000)

  // Find the scrollable container
  const scrollInfo = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*')
    const scrollables: { tag: string; class: string; scrollH: number; clientH: number; id: string }[] = []
    allElements.forEach(el => {
      if (el.scrollHeight > el.clientHeight + 50) {
        scrollables.push({
          tag: el.tagName,
          class: (el.className || '').toString().substring(0, 100),
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
          id: el.id || '',
        })
      }
    })
    return scrollables.slice(0, 15)
  })
  console.log('=== SCROLLABLE CONTAINERS ===')
  console.log(JSON.stringify(scrollInfo, null, 2))

  // Scroll inside the main content area and capture sections
  const sections = [
    { name: 'top', scrollTop: 0 },
    { name: 'section2', scrollTop: 700 },
    { name: 'section3', scrollTop: 1400 },
    { name: 'section4', scrollTop: 2100 },
    { name: 'section5', scrollTop: 2800 },
    { name: 'section6', scrollTop: 3500 },
    { name: 'section7', scrollTop: 4200 },
    { name: 'bottom', scrollTop: 9999 },
  ]

  for (const section of sections) {
    await page.evaluate((scrollTop) => {
      // Try scrolling various possible containers
      const containers = [
        document.querySelector('main'),
        document.querySelector('[class*="flex-1"]'),
        document.querySelector('[class*="overflow"]'),
        document.documentElement,
        document.body,
      ]
      for (const c of containers) {
        if (c && c.scrollHeight > c.clientHeight + 50) {
          c.scrollTop = scrollTop
          break
        }
      }
    }, section.scrollTop)
    await page.waitForTimeout(300)
    await page.screenshot({
      path: `e2e/screenshots/scroll-${section.name}.png`,
    })
  }
})

test('Capture via element screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })

  await page.goto('/login')
  await page.fill('#email', 'hanungsastria13@gmail.com')
  await page.fill('#password', 'sayalupa')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await page.waitForTimeout(5000)

  // Try to find and screenshot the main content area directly
  const mainContent = page.locator('main').first()
  if (await mainContent.isVisible()) {
    // Get the actual scrollable height of main
    const mainDims = await mainContent.evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      offsetHeight: (el as HTMLElement).offsetHeight,
    }))
    console.log('=== MAIN ELEMENT DIMS ===')
    console.log(JSON.stringify(mainDims, null, 2))
  }

  // Screenshot individual widget sections by finding them
  const widgetTitles = [
    'Monthly Revenue vs Target',
    'Pipeline Stages',
    'Sales Performance vs Target',
    'Top Revenue Generators',
    'Lead Source',
    'Lead Classification',
    'Stream Alignment',
    'Top Contacts by Revenue',
    'Goal Attainment',
    'Weighted Forecast',
    'Variance / Gap',
    'Historical Trend',
  ]

  for (const title of widgetTitles) {
    const widget = page.locator(`text="${title}"`).first()
    if (await widget.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Scroll to it first
      await widget.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)

      // Find parent card/container
      const parent = widget.locator('xpath=ancestor::div[contains(@style, "border") or contains(@style, "background")]').first()
      if (await parent.isVisible({ timeout: 500 }).catch(() => false)) {
        await parent.screenshot({
          path: `e2e/screenshots/widget-${title.toLowerCase().replace(/[\s\/]/g, '-')}.png`,
        })
        console.log(`Captured widget: ${title}`)
      } else {
        // Just screenshot the area around the title
        await page.screenshot({
          path: `e2e/screenshots/widget-${title.toLowerCase().replace(/[\s\/]/g, '-')}.png`,
        })
        console.log(`Captured viewport at: ${title}`)
      }
    } else {
      console.log(`Widget NOT visible: ${title}`)
    }
  }
})
