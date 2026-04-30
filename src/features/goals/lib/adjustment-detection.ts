/**
 * Post-Win Adjustment Detection
 *
 * Detects when reporting-critical fields on a Closed Won lead
 * have been modified, triggering a post_win_adjustments record.
 */

export interface FieldChange {
  field_name: string
  old_value: string | null
  new_value: string | null
}

/**
 * Compares current lead data against the update payload to detect
 * changes in critical fields. Returns null if no critical changes found.
 */
export function detectCriticalFieldChange(
  currentLead: Record<string, unknown>,
  payload: Record<string, unknown>,
  criticalFields: string[]
): FieldChange[] | null {
  const changes: FieldChange[] = []

  for (const field of criticalFields) {
    if (!(field in payload)) continue

    const oldVal = currentLead[field]
    const newVal = payload[field]

    // Normalize for comparison
    const oldStr = oldVal == null ? null : String(oldVal)
    const newStr = newVal == null ? null : String(newVal)

    if (oldStr !== newStr) {
      changes.push({
        field_name: field,
        old_value: oldStr,
        new_value: newStr,
      })
    }
  }

  return changes.length > 0 ? changes : null
}
