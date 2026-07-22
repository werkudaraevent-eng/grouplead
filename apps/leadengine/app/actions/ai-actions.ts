"use server"

import { createAIClient, getAIModelFast, getAIModelReasoning } from "@/lib/ai-client"
import type { ActionResult } from "@/types/action-result"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DashboardAnalysis {
  summary: string
  insights: string[]
  recommendations: string[]
  risks: string[]
}

export interface AskAIResponse {
  answer: string
}

// ─── Analyze Dashboard ──────────────────────────────────────────────────────

export async function analyzeDashboard(
  dashboardData: Record<string, unknown>
): Promise<ActionResult<DashboardAnalysis>> {
  try {
    const client = createAIClient()
    const model = getAIModelReasoning()

    const systemPrompt = `You are a senior sales analytics consultant analyzing a CRM dashboard for Werkudara Group.
Respond in Bahasa Indonesia. Be concise, data-driven, and actionable.
Format your response as JSON with these keys:
- summary: 2-3 sentence executive summary
- insights: array of 3-5 key insights from the data
- recommendations: array of 2-4 actionable recommendations
- risks: array of 1-3 potential risks or concerns

Focus on: revenue trends, win rates, pipeline health, conversion efficiency, and goal attainment.`

    const userPrompt = `Analyze this dashboard data:\n\n${JSON.stringify(dashboardData, null, 2)}`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }) as any // enowxai may return non-standard shape

    // Handle various response shapes from different proxies
    const choice = response?.choices?.[0]
    const content = choice?.message?.content
      || choice?.message?.reasoning_content
      || (typeof response?.output === "string" ? response.output : null)

    if (!content) {
      console.error("[AI] Empty response. Raw:", JSON.stringify(response, null, 2))
      return { success: false, error: `AI returned empty response (model: ${model})` }
    }

    // Extract JSON from response (may be wrapped in ```json ... ```)
    let jsonStr = content.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1].trim()

    const parsed = JSON.parse(jsonStr) as DashboardAnalysis

    return { success: true, data: parsed }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI analysis failed"
    return { success: false, error: message }
  }
}

// ─── Ask AI (free-form question) ────────────────────────────────────────────

export async function askAI(
  question: string,
  dashboardContext: Record<string, unknown>
): Promise<ActionResult<AskAIResponse>> {
  try {
    const client = createAIClient()
    const model = getAIModelFast()

    const systemPrompt = `You are a helpful sales analytics assistant for Werkudara Group's CRM (LeadEngine).
You have access to the current dashboard data. Answer questions about sales performance, leads, revenue, goals, and pipeline.
Respond in Bahasa Indonesia unless the user writes in English.
Be concise and data-driven. Use numbers from the provided data when relevant.
If you don't have enough data to answer, say so clearly.`

    const userPrompt = `Dashboard context:\n${JSON.stringify(dashboardContext, null, 2)}\n\nUser question: ${question}`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }) as any

    const choice = response?.choices?.[0]
    const answer = choice?.message?.content
      || choice?.message?.reasoning_content
      || (typeof response?.output === "string" ? response.output : null)

    if (!answer) {
      console.error("[AI] Empty response. Raw:", JSON.stringify(response, null, 2))
      return { success: false, error: `AI returned empty response (model: ${model})` }
    }

    return { success: true, data: { answer } }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI request failed"
    return { success: false, error: message }
  }
}
