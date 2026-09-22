"use server"

import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import {
  CONVERSATION_LIST_LIMIT,
  parseTurns,
  type Conversation,
  type ConversationSummary,
} from "@/lib/ai/ask-conversations"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * The Tanya AI threads a person may read: their own, and nobody else's.
 *
 * Everything here goes through the session client, so RLS is the boundary
 * and not a filter the code has to remember; the explicit `user_id` filter
 * is only there so the index is used. The panel must keep working on a
 * deployment where the table is not there yet, so a query that fails is an
 * empty history, never an error in the person's face.
 */

const idSchema = z.string().uuid("Percakapan tidak ditemukan.")

async function gate() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_ai", "read"))) return { error: "Anda tidak punya izin memakai Tanya AI." }
  return { access }
}

/** The person's conversations, most recently used first. */
export async function listConversations(): Promise<ActionResult<ConversationSummary[]>> {
  const g = await gate()
  if ("error" in g) return { success: false, error: g.error }
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("ai_conversations")
    .select("id, title, turn_count, updated_at")
    .eq("company_id", g.access.companyId)
    .eq("user_id", g.access.userId)
    .order("updated_at", { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT)
  if (error) return { success: true, data: [] }
  return {
    success: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as string | null) ?? "Percakapan",
      updatedAt: row.updated_at as string,
      turnCount: Number(row.turn_count ?? 0),
    })),
  }
}

/** One thread with its turns, to read and to carry on. */
export async function getConversation(input: unknown): Promise<ActionResult<Conversation>> {
  const g = await gate()
  if ("error" in g) return { success: false, error: g.error }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Percakapan tidak ditemukan." }
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("ai_conversations")
    .select("id, title, turns")
    .eq("company_id", g.access.companyId)
    .eq("user_id", g.access.userId)
    .eq("id", parsed.data)
    .maybeSingle()
  if (!data) return { success: false, error: "Percakapan tidak ditemukan." }
  return { success: true, data: { id: data.id as string, title: (data.title as string | null) ?? "Percakapan", turns: parseTurns(data.turns) } }
}

/** Throw one away. One person's own note, so there is nothing to confirm. */
export async function deleteConversation(input: unknown): Promise<ActionResult> {
  const g = await gate()
  if ("error" in g) return { success: false, error: g.error }
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Percakapan tidak ditemukan." }
  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("ai_conversations")
    .delete()
    .eq("company_id", g.access.companyId)
    .eq("user_id", g.access.userId)
    .eq("id", parsed.data)
  if (error) return { success: false, error: "Percakapan tidak bisa dihapus." }
  return { success: true }
}
