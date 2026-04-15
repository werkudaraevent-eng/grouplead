const MANDATORY_MINIMUM_FIELDS = [
  'actual_value',
  'event_date_start',
  'event_date_end',
  'project_name',
  'company_id',
  'pic_sales_id',
] as const

/**
 * Validates that an update to the critical fields list preserves the
 * mandatory minimum set. Fields may be added but the minimum set
 * cannot be removed.
 */
export function validateCriticalFieldUpdate(
  currentFields: string[],
  newFields: string[]
): { valid: boolean; error?: string } {
  const newSet = new Set(newFields)
  const missing: string[] = []

  for (const field of MANDATORY_MINIMUM_FIELDS) {
    if (!newSet.has(field)) {
      missing.push(field)
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Cannot remove mandatory critical fields: ${missing.join(', ')}`,
    }
  }

  return { valid: true }
}

export { MANDATORY_MINIMUM_FIELDS }
