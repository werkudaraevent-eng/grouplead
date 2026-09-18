import { buildFunnelSteps, type FunnelCounts } from "@/lib/prospects/prospect-funnel"

/**
 * The prospect funnel as a list of bars: each step's share of the cohort
 * as width, its share of the previous step as the quiet number beside it.
 * A list, not a chart, so the numbers are readable and the card scales.
 */
export function FunnelCard({ counts }: { counts: FunnelCounts }) {
  const steps = buildFunnelSteps(counts)
  return (
    <article className="rounded-xl border bg-card">
      <div className="border-b px-5 py-4">
        <p className="text-xs font-semibold text-muted-foreground">Prospek</p>
        <h2 className="mt-1 text-base font-semibold text-foreground">Corong dari prospek ke lead</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Prospek yang dibuat pada rentang ini, dan sejauh mana mereka sampai.</p>
      </div>
      {counts.total === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Belum ada prospek pada rentang ini.</p>
      ) : (
        <ol className="divide-y">
          {steps.map((step) => (
            <li key={step.key} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{step.label}</span>
                <span className="tabular-nums">
                  <span className="font-semibold text-foreground">{step.value}</span>
                  {step.pctOfPrevious !== null && <span className="ml-2 text-xs text-muted-foreground">{step.pctOfPrevious}% dari langkah sebelumnya</span>}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(step.pctOfTotal, step.value > 0 ? 2 : 0)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
