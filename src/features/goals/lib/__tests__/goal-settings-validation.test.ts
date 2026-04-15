import { describe, it, expect } from 'vitest'
import { validateCriticalFieldUpdate, MANDATORY_MINIMUM_FIELDS } from '../goal-settings-validation'

describe('validateCriticalFieldUpdate', () => {
  const minimumSet = [...MANDATORY_MINIMUM_FIELDS]

  it('accepts the minimum set unchanged', () => {
    const result = validateCriticalFieldUpdate(minimumSet, [...minimumSet])
    expect(result.valid).toBe(true)
  })

  it('accepts adding new fields to the minimum set', () => {
    const result = validateCriticalFieldUpdate(minimumSet, [...minimumSet, 'custom_field'])
    expect(result.valid).toBe(true)
  })

  it('rejects removing a mandatory field', () => {
    const newFields = minimumSet.filter((f) => f !== 'actual_value')
    const result = validateCriticalFieldUpdate(minimumSet, newFields)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('actual_value')
  })

  it('rejects removing multiple mandatory fields', () => {
    const newFields = ['custom_field']
    const result = validateCriticalFieldUpdate(minimumSet, newFields)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('actual_value')
    expect(result.error).toContain('event_date_start')
  })

  it('rejects empty new fields list', () => {
    const result = validateCriticalFieldUpdate(minimumSet, [])
    expect(result.valid).toBe(false)
  })

  it('accepts reordered minimum set', () => {
    const reordered = [...minimumSet].reverse()
    const result = validateCriticalFieldUpdate(minimumSet, reordered)
    expect(result.valid).toBe(true)
  })

  it('accepts minimum set with duplicates', () => {
    const result = validateCriticalFieldUpdate(minimumSet, [...minimumSet, 'actual_value'])
    expect(result.valid).toBe(true)
  })
})
