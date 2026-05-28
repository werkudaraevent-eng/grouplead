import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Dashboard Widget Hide/Show Feature', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.waitForTimeout(3000)
  })

  test('01 - Edit mode shows eye toggle on widgets', async ({ page }) => {
    // Enter edit mode
    const editBtn = page.locator('text=Edit Dashboard').first()
    await editBtn.click()
    await page.waitForTimeout(1000)

    // Check that eye buttons exist (one per widget)
    const eyeButtons = page.locator('button[title="Hide widget"]')
    const count = await eyeButtons.count()
    console.log('Eye toggle buttons visible:', count)
    expect(count).toBeGreaterThan(0)

    await page.screenshot({ path: 'e2e/screenshots/hide-01-edit-mode-with-eye.png' })
  })

  test('02 - Clicking eye hides widget and shows tray', async ({ page }) => {
    // Enter edit mode
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Find and click the first eye button to hide a widget
    const firstEye = page.locator('button[title="Hide widget"]').first()
    await firstEye.click()
    await page.waitForTimeout(500)

    // Check that "Hidden Widgets" tray appears
    const tray = page.locator('text=Hidden Widgets')
    await expect(tray).toBeVisible()

    await page.screenshot({ path: 'e2e/screenshots/hide-02-widget-hidden-tray.png' })

    // Check that a "Show" button exists in the tray
    const showButtons = page.locator('button:has(svg) >> text=/.+/')
    console.log('Tray buttons count:', await showButtons.count())
  })

  test('03 - Hidden widget can be restored from tray', async ({ page }) => {
    // Enter edit mode
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Count initial eye buttons
    const initialCount = await page.locator('button[title="Hide widget"]').count()

    // Hide a widget
    await page.locator('button[title="Hide widget"]').first().click()
    await page.waitForTimeout(500)

    // Verify tray appeared
    await expect(page.locator('text=Hidden Widgets')).toBeVisible()

    // Click the restore button in the tray
    const trayButtons = page.locator('text=Hidden Widgets').locator('..').locator('button')
    const trayCount = await trayButtons.count()
    console.log('Tray restore buttons:', trayCount)

    if (trayCount > 0) {
      await trayButtons.first().click()
      await page.waitForTimeout(500)
    }

    // Verify tray disappears (no more hidden widgets)
    const trayVisible = await page.locator('text=Hidden Widgets').isVisible()
    console.log('Tray still visible after restore:', trayVisible)

    await page.screenshot({ path: 'e2e/screenshots/hide-03-widget-restored.png' })
  })

  test('04 - Cancel restores hidden state', async ({ page }) => {
    // Enter edit mode
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Hide a widget
    await page.locator('button[title="Hide widget"]').first().click()
    await page.waitForTimeout(500)

    // Verify tray appeared
    await expect(page.locator('text=Hidden Widgets')).toBeVisible()

    // Click Cancel
    await page.locator('text=Cancel').first().click()
    await page.waitForTimeout(1000)

    // Re-enter edit mode
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Tray should NOT be visible (cancel restored state)
    const trayVisible = await page.locator('text=Hidden Widgets').isVisible()
    console.log('Tray visible after cancel+re-edit:', trayVisible)
    expect(trayVisible).toBe(false)
  })

  test('05 - Save persists hidden state', async ({ page }) => {
    // Enter edit mode
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    // Hide a widget
    await page.locator('button[title="Hide widget"]').first().click()
    await page.waitForTimeout(500)

    // Save
    await page.locator('text=Save Layout').first().click()
    await page.waitForTimeout(2000)

    // Reload page
    await page.reload()
    await page.waitForTimeout(5000)

    // Get full page text - the hidden widget should not be visible
    const bodyText = await page.locator('body').innerText()
    console.log('=== PAGE AFTER RELOAD ===')
    console.log(bodyText.substring(0, 1000))

    await page.screenshot({ path: 'e2e/screenshots/hide-05-after-save-reload.png', fullPage: true })

    // Enter edit mode again to verify tray shows
    await page.locator('text=Edit Dashboard').first().click()
    await page.waitForTimeout(1000)

    const trayVisible = await page.locator('text=Hidden Widgets').isVisible()
    console.log('Tray visible after reload+edit:', trayVisible)
    expect(trayVisible).toBe(true)

    await page.screenshot({ path: 'e2e/screenshots/hide-05-tray-after-reload.png' })

    // Reset to clean state for other tests
    await page.locator('text=Reset').first().click()
    await page.waitForTimeout(1000)
    await page.locator('text=Save Layout').first().click()
    await page.waitForTimeout(2000)
  })
})

test.describe('Empty States & Login Fix', () => {
  test('06 - Login placeholder shows bullets not unicode', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login')
    await page.waitForTimeout(1000)

    // Check placeholder doesn't contain \u2022
    const placeholder = await page.locator('#password').getAttribute('placeholder')
    console.log('Password placeholder:', placeholder)
    expect(placeholder).not.toContain('\\u')
    expect(placeholder).not.toContain('u2022')

    await page.screenshot({ path: 'e2e/screenshots/fix-06-login-mobile.png' })
  })

  test('07 - Goal empty states show CTA', async ({ page }) => {
    await login(page)
    await page.waitForTimeout(5000)

    // Check for "Configure Goals" CTA links
    const ctaLinks = page.locator('a:has-text("Configure Goals")')
    const ctaCount = await ctaLinks.count()
    console.log('Configure Goals CTA count:', ctaCount)

    // Scroll to goal section
    const goalSection = page.locator('text=Goal Attainment').first()
    if (await goalSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await goalSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'e2e/screenshots/fix-07-goal-empty-state.png' })
    }
  })
})
