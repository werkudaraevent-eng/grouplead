/**
 * The prospect funnel, from a cohort's counts to rows a card can draw.
 *
 * Six steps. "Dihubungi" and "In Progress" both compare against the total,
 * because In Progress is not a subset of contacted in time (a prospect can
 * be moved to In Progress before any attempt is logged); the later steps
 * compare against the step before, which is the conversion a manager asks
 * about: of the appointments made, how many were visited and reported; of
 * those, how many became leads.
 */
export interface FunnelCounts {
  total: number
  contacted: number
  inProgress: number
  confirmed: number
  completed: number
  leadPushed: number
}

export interface FunnelStep {
  key: keyof FunnelCounts
  label: string
  value: number
  /** Share of the cohort, 0–100. */
  pctOfTotal: number
  /** Share of the reference step, 0–100, or null for the first step. */
  pctOfPrevious: number | null
}

const STEPS: Array<{ key: keyof FunnelCounts; label: string; previous: keyof FunnelCounts | null }> = [
  { key: "total", label: "Prospek", previous: null },
  { key: "contacted", label: "Dihubungi", previous: "total" },
  { key: "inProgress", label: "In Progress", previous: "total" },
  { key: "confirmed", label: "Confirmed", previous: "contacted" },
  { key: "completed", label: "Dikunjungi dan dilaporkan", previous: "confirmed" },
  { key: "leadPushed", label: "Lead dikirim ke CRM", previous: "completed" },
]

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export function buildFunnelSteps(counts: FunnelCounts): FunnelStep[] {
  return STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    value: counts[step.key],
    pctOfTotal: pct(counts[step.key], counts.total),
    pctOfPrevious: step.previous ? pct(counts[step.key], counts[step.previous]) : null,
  }))
}
