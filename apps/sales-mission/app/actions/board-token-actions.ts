"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { generateBoardToken, type BoardTokenKind } from "@/lib/board/board-access"
import { paths } from "@/lib/paths"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/** Board token management. Admin-only, and the plaintext is shown exactly once. */

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { error: "Anda tidak punya izin mengelola tautan papan." as const }
  }

  return { access }
}

export async function createBoardToken(
  label: string,
  expiresInDays?: number,
  showClientNames = false,
  kind: BoardTokenKind = "screen"
): Promise<ActionResult<{ token: string }>> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const trimmed = label.trim()
  if (!trimmed) return { success: false, error: "Beri nama tautan agar bisa dikenali nanti." }
  if (trimmed.length > 100) return { success: false, error: "Nama tautan terlalu panjang." }

  const { token, hash } = generateBoardToken()

  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null

  const supabase = await createClient()
  const { error } = await supabase.schema("sales_mission").from("board_tokens").insert({
    company_id: access.companyId,
    label: trimmed,
    token_hash: hash,
    expires_at: expiresAt,
    created_by: access.userId,
    // Decided here, once, by the admin. A screen in an open office keeps it
    // false; a screen in the sales room may not need to.
    show_client_names: showClientNames,
    // Bound to the row, so a screen link cannot be typed into the calendar
    // route or the other way round.
    kind,
  })

  if (error) return { success: false, error: "Tautan gagal dibuat." }

  revalidatePath(paths.settings.board)
  revalidatePath(paths.board)
  revalidatePath(paths.calendar)

  // The only time the plaintext exists outside the browser that asked for it.
  // Nothing stores it, so a lost link means creating a new one.
  return { success: true, data: { token } }
}

export async function revokeBoardToken(tokenId: string): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("board_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("company_id", guard.access.companyId)

  if (error) return { success: false, error: "Tautan gagal dicabut." }

  revalidatePath(paths.settings.board)
  return { success: true }
}
