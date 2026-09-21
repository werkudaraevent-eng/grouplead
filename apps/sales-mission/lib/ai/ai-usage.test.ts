import { describe, expect, it } from "vitest"
import { summarizeUsage, type UsageRow } from "./ai-usage"

const now = new Date("2026-09-21T09:00:00Z")
const row = (daysAgo: number, over: Partial<UsageRow> = {}): UsageRow => ({
  app: "sales_mission",
  feature: "tanya_ai",
  model: "gpt-x",
  prompt_tokens: 1000,
  completion_tokens: 100,
  ok: true,
  created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  ...over,
})

describe("summarizeUsage", () => {
  it("sums the last 7 and 30 days, per feature and per model, and drops what is older", () => {
    const rows = [row(1), row(3, { feature: "insight", model: "gpt-r", prompt_tokens: 5000, completion_tokens: 500 }), row(10, { app: "leadengine", feature: "ask_ai" }), row(40)]
    const summary = summarizeUsage(rows, now)
    expect(summary.last7).toEqual({ calls: 2, failed: 0, promptTokens: 6000, completionTokens: 600, total: 6600 })
    expect(summary.last30).toEqual({ calls: 3, failed: 0, promptTokens: 7000, completionTokens: 700, total: 7700 })
    expect(summary.byFeature.map((item) => [item.app, item.key, item.total])).toEqual([
      ["sales_mission", "insight", 5500],
      ["sales_mission", "tanya_ai", 1100],
      ["leadengine", "ask_ai", 1100],
    ])
    expect(summary.byModel.map((item) => [item.key, item.total])).toEqual([
      ["gpt-r", 5500],
      ["gpt-x", 2200],
    ])
  })

  it("projects a week and a month from the last 7 days", () => {
    const rows = Array.from({ length: 7 }, (_, index) => row(index, { prompt_tokens: 900, completion_tokens: 100 }))
    const summary = summarizeUsage(rows, now)
    expect(summary.projectedWeek).toBe(7000)
    expect(summary.projectedMonth).toBe(30000)
  })

  it("scales a log younger than a week from the calendar days it covers", () => {
    const summary = summarizeUsage([row(0.5, { prompt_tokens: 1000, completion_tokens: 0 }), row(1.5, { prompt_tokens: 1000, completion_tokens: 0 })], now)
    // The oldest row is 1.5 days old: two calendar days, 1000 tokens a day.
    expect(summary.projectedWeek).toBe(7000)
    expect(summary.projectedMonth).toBe(30000)
  })

  it("counts failed calls and tolerates missing token counts", () => {
    const summary = summarizeUsage([row(1, { ok: false, prompt_tokens: null, completion_tokens: null })], now)
    expect(summary.last7).toEqual({ calls: 1, failed: 1, promptTokens: 0, completionTokens: 0, total: 0 })
    expect(summarizeUsage([], now).since).toBeNull()
  })
})
