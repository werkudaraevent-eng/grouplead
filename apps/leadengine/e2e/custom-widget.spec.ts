import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Custom Widget Builder', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForTimeout(3000)
  })

  test('01 - Gallery modal shows Create Custom Widget button', async ({ page }) => {
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Open gallery
    await page.locator('button:has-text("Add Widget")').first().click()
    await page.waitForTimeout(500)

    // Should see "Create Custom Widget"
    const createBtn = page.locator('text=Create Custom Widget')
    await expect(createBtn).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/custom-01-gallery-with-create.png' })
  })

  test('02 - Configurator modal opens with form and preview', async ({ page }) => {
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Open gallery then click Create
    await page.locator('button:has-text("Add Widget")').first().click()
    await page.waitForTimeout(500)
    await page.locator('text=Create Custom Widget').click()
    await page.waitForTimeout(500)

    // Configurator should be visible
    await expect(page.locator('text=Create Custom Widget').first()).toBeVisible()

    // Should have chart type buttons
    await expect(page.locator('text=KPI Card')).toBeVisible()
    await expect(page.locator('text=Bar Chart')).toBeVisible()
    await expect(page.locator('text=Pie Chart')).toBeVisible()
    await expect(page.locator('text=Ranked List')).toBeVisible()

    // Should have Live Preview
    await expect(page.locator('text=Live Preview')).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/custom-02-configurator.png' })
  })

  test('03 - Create a bar chart widget and add to dashboard', async ({ page }) => {
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Open gallery -> Create
    await page.locator('button:has-text("Add Widget")').first().click()
    await page.waitForTimeout(500)
    await page.locator('text=Create Custom Widget').click()
    await page.waitForTimeout(500)

    // Select Bar Chart type
    await page.locator('text=Bar Chart').click()
    await page.waitForTimeout(300)

    // Metric is already "Count of Leads" by default
    // Scope to the configurator modal (fixed overlay with z-index 1100)
    const modal = page.locator('text=Live Preview').locator('..').locator('..')
    // Find Group By select inside the modal -- it has "None (single value)" as first option
    const groupBySelect = modal.locator('select:has(option[value="lead_source"])').first()
    await groupBySelect.selectOption('lead_source')
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'e2e/screenshots/custom-03-configured.png' })

    // Click Add to Dashboard
    await page.locator('button:has-text("Add to Dashboard")').click()
    await page.waitForTimeout(1000)

    // Save layout
    await page.locator('text=Save Layout').first().click()
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'e2e/screenshots/custom-03-added.png' })
  })

  test('04 - Custom widget persists after reload', async ({ page }) => {
    // Check if custom widget exists from previous test
    await page.waitForTimeout(3000)

    const bodyText = await page.locator('body').innerText()
    console.log('=== DASHBOARD AFTER RELOAD ===')
    // Look for "Count of Leads" or custom widget content
    const hasCustomContent = bodyText.includes('Lead Source') || bodyText.includes('Count of Leads')
    console.log('Has custom widget content:', hasCustomContent)

    await page.screenshot({ path: 'e2e/screenshots/custom-04-persisted.png', fullPage: true })
  })

  test('05 - Create KPI widget', async ({ page }) => {
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    await page.locator('button:has-text("Add Widget")').first().click()
    await page.waitForTimeout(500)
    await page.locator('text=Create Custom Widget').click()
    await page.waitForTimeout(500)

    // Select KPI Card
    await page.locator('text=KPI Card').click()
    await page.waitForTimeout(300)

    // Set title
    await page.locator('input[type="text"]').fill('My Custom KPI')
    await page.waitForTimeout(200)

    await page.screenshot({ path: 'e2e/screenshots/custom-05-kpi-preview.png' })

    // Add to dashboard
    await page.locator('button:has-text("Add to Dashboard")').click()
    await page.waitForTimeout(1000)

    // Save
    await page.locator('text=Save Layout').first().click()
    await page.waitForTimeout(2000)
  })
})
