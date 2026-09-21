import type { UsageSummary, UsageTotals } from "@/lib/ai/ai-usage"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

/**
 * What the proxy is asked for, in tokens: the last week and month, what a
 * week and a month cost at that pace, and where it goes (per feature, per
 * model). Tokens, never money, because the price is the proxy's; the same
 * card sits under Settings → AI in LeadEngine because the bill is one.
 */

const FEATURE_LABELS: Record<string, string> = {
  "sales_mission:insight": "Insight hari ini · Sales Activity",
  "sales_mission:tanya_ai": "Tanya AI · Sales Activity",
  "leadengine:ask_ai": "Ask AI · LeadEngine",
  "leadengine:analyze": "Analyze · LeadEngine",
  "sales_mission:uji_model": "Uji model · Sales Activity",
  "leadengine:uji_model": "Uji model · LeadEngine",
}

const number = new Intl.NumberFormat("id-ID")
const fmt = (value: number) => number.format(value)

export function UsageCard({ summary }: { summary: UsageSummary }) {
  const rows: Array<{ label: string; totals?: UsageTotals; projected?: number }> = [
    { label: "7 hari terakhir", totals: summary.last7 },
    { label: "30 hari terakhir", totals: summary.last30 },
    { label: "Perkiraan seminggu", projected: summary.projectedWeek },
    { label: "Perkiraan sebulan", projected: summary.projectedMonth },
  ]
  const since = summary.since ? new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(summary.since)) : null

  return (
    <section className="overflow-clip rounded-xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Pemakaian</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Token yang dipakai kedua aplikasi lewat proxy ini, 30 hari terakhir. Perkiraan dihitung dari laju 7 hari terakhir. Harganya mengikuti tarif proxy per token.
        </p>
      </header>
      {summary.last30.calls === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Belum ada catatan. Pemakaian dicatat sejak fitur ini ada; kembali setelah ada insight atau pertanyaan.</p>
      ) : (
        <div className="space-y-6 px-5 py-4">
          <UsageTable
            caption="Ringkasan"
            head={["Periode", "Panggilan", "Token masuk", "Token keluar", "Total token"]}
            rows={rows.map((row) => [
              row.label,
              row.totals ? fmt(row.totals.calls) : "—",
              row.totals ? fmt(row.totals.promptTokens) : "—",
              row.totals ? fmt(row.totals.completionTokens) : "—",
              fmt(row.totals ? row.totals.total : (row.projected ?? 0)),
            ])}
          />
          <UsageTable
            caption="Per fitur, 30 hari"
            head={["Fitur", "Panggilan", "Gagal", "Total token"]}
            rows={summary.byFeature.map((item) => [FEATURE_LABELS[`${item.app}:${item.key}`] ?? `${item.key} · ${item.app}`, fmt(item.calls), fmt(item.failed), fmt(item.total)])}
          />
          <UsageTable caption="Per model, 30 hari" head={["Model", "Panggilan", "Total token"]} rows={summary.byModel.map((item) => [item.key, fmt(item.calls), fmt(item.total)])} />
          {since && <p className="text-xs text-muted-foreground">Catatan tertua dalam 30 hari ini: {since}. Panggilan yang gagal dihitung tanpa token.</p>}
        </div>
      )}
    </section>
  )
}

function UsageTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
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
