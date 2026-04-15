import type { LeadAttainmentInput } from '@/types/goals'

/**
 * Calculates attainment from Closed Won leads.
 *
 * Only leads with `is_closed_won === true` contribute to attainment.
 * Sums `actual_value` for all Closed Won leads (null actual_value counts as 0).
 */
export function calculateAttainmentV2(
  leads: LeadAttainmentInput[]
): { total: number; lead_count: number } {
  let total = 0
  let lead_count = 0

  for (const lead of leads) {
    if (!lead.is_closed_won) continue
    total += lead.actual_value ?? 0
    lead_count++
  }

  return { total, lead_count }
}
