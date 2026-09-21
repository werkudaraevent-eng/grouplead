import type { UsageSummary, UsageTotals } from "@/lib/ai/ai-usage"

/**
 * What the proxy is asked for, in tokens: the last week and month, what a
 * week and a month cost at that pace, and where it goes (per feature, per
 * model). Tokens, never money, because the price is the proxy's; the same
 * card sits under Pengaturan → AI in Sales Activity because the bill is one.
 */

const FEATURE_LABELS: Record<string, string> = {
  "leadengine:ask_ai": "Ask AI · LeadEngine",
  "leadengine:analyze": "Analyze · LeadEngine",
  "sales_mission:insight": "Daily insight · Sales Activity",
  "sales_mission:tanya_ai": "Tanya AI · Sales Activity",
  "leadengine:uji_model": "Model check · LeadEngine",
  "sales_mission:uji_model": "Model check · Sales Activity",
}

const number = new Intl.NumberFormat("en-US")
const fmt = (value: number) => number.format(value)

export function AiUsageCard({ summary }: { summary: UsageSummary }) {
  const rows: Array<{ label: string; totals?: UsageTotals; projected?: number }> = [
    { label: "Last 7 days", totals: summary.last7 },
    { label: "Last 30 days", totals: summary.last30 },
    { label: "Projected per week", projected: summary.projectedWeek },
    { label: "Projected per month", projected: summary.projectedMonth },
  ]
  const since = summary.since ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }).format(new Date(summary.since)) : null

  return (
    <section className="overflow-clip rounded-xl border bg-card shadow-sm">
      <header className="border-b px-5 py-4">
        <h2 className="text-[14px] font-semibold text-foreground">Usage</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Tokens both apps sent through this proxy in the last 30 days. Projections use the last 7 days&apos; pace. Cost follows the proxy&apos;s price per token.
        </p>
      </header>
      {summary.last30.calls === 0 ? (
        <p className="px-5 py-6 text-[13px] text-muted-foreground">Nothing recorded yet. Usage is logged from the moment this card shipped; come back after an insight or a question.</p>
      ) : (
        <div className="space-y-6 px-5 py-4">
          <UsageTable
            caption="Summary"
            head={["Period", "Calls", "Input tokens", "Output tokens", "Total tokens"]}
            rows={rows.map((row) => [
              row.label,
              row.totals ? fmt(row.totals.calls) : "—",
              row.totals ? fmt(row.totals.promptTokens) : "—",
              row.totals ? fmt(row.totals.completionTokens) : "—",
              fmt(row.totals ? row.totals.total : (row.projected ?? 0)),
            ])}
          />
          <UsageTable
            caption="By feature, 30 days"
            head={["Feature", "Calls", "Failed", "Total tokens"]}
            rows={summary.byFeature.map((item) => [FEATURE_LABELS[`${item.app}:${item.key}`] ?? `${item.key} · ${item.app}`, fmt(item.calls), fmt(item.failed), fmt(item.total)])}
          />
          <UsageTable caption="By model, 30 days" head={["Model", "Calls", "Total tokens"]} rows={summary.byModel.map((item) => [item.key, fmt(item.calls), fmt(item.total)])} />
          {since && <p className="text-[12px] text-muted-foreground">Oldest record in these 30 days: {since}. Failed calls count without tokens.</p>}
        </div>
      )}
    </section>
  )
}

function UsageTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <caption className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-[12px] text-muted-foreground">
            {head.map((cell, index) => (
              <th key={cell} scope="col" className={`py-2 pr-4 font-medium ${index > 0 ? "text-right" : ""}`}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells) => (
            <tr key={cells[0]} className="border-b last:border-0">
              {cells.map((cell, index) => (
                <td key={index} className={`py-2 pr-4 ${index > 0 ? "text-right tabular-nums" : "text-foreground"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
