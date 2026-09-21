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

export interface CreateBoardTokenOptions {
  expiresInDays?: number
  /** The two privacy decisions, made here once and bound to the row. */
  showClientNames?: boolean
  showOutcomes?: boolean
  /**
   * Screen links only: also make a calendar link, with the same name masking,
   * for the wall to draw as a QR. It is a row of its own in the link list and
   * can be revoked on its own.
   */
  calendarQr?: boolean
  kind?: BoardTokenKind
}

export async function createBoardToken(
  label: string,
  { expiresInDays, showClientNames = false, showOutcomes = false, calendarQr = false, kind = "screen" }: CreateBoardTokenOptions = {}
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

  // The QR's calendar link first, so the screen row can point at it. Same
  // masking and lifetime as the screen; its own hash, its own revocation.
  let qr: { id: string; token: string } | null = null
  if (kind === "screen" && calendarQr) {
    const calendar = generateBoardToken()
    const { data: calendarRow, error: calendarError } = await supabase
      .schema("sales_mission")
      .from("board_tokens")
      .insert({
        company_id: access.companyId,
        label: `${trimmed} · QR`,
        token_hash: calendar.hash,
        expires_at: expiresAt,
        created_by: access.userId,
        show_client_names: showClientNames,
        show_outcomes: false,
        kind: "calendar",
      })
      .select("id")
      .single()
    if (calendarError || !calendarRow) return { success: false, error: "Tautan kalender untuk QR gagal dibuat." }
    qr = { id: calendarRow.id as string, token: calendar.token }
  }

  const { error } = await supabase.schema("sales_mission").from("board_tokens").insert({
    company_id: access.companyId,
    label: trimmed,
    token_hash: hash,
    expires_at: expiresAt,
    created_by: access.userId,
    // Printed on the wall as a QR, so the plaintext lives here on purpose.
    qr_calendar_token_id: qr?.id ?? null,
    qr_calendar_token: qr?.token ?? null,
    // Decided here, once, by the admin. A screen in an open office keeps it
    // false; a screen in the sales room may not need to.
    show_client_names: showClientNames,
    // Outcomes only mean something on a screen; a calendar link never shows them.
    show_outcomes: kind === "screen" && showOutcomes,
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
  const revokedAt = new Date().toISOString()
  const { data: row, error } = await supabase
    .schema("sales_mission")
    .from("board_tokens")
    .update({ revoked_at: revokedAt })
    .eq("id", tokenId)
    .eq("company_id", guard.access.companyId)
    .select("qr_calendar_token_id")
    .maybeSingle()

  if (error) return { success: false, error: "Tautan gagal dicabut." }

  // A screen's QR calendar link goes with it: nobody can scan a wall that is
  // no longer showing it, and an orphan link would outlive its purpose.
  const pairedId = (row?.qr_calendar_token_id as string | null) ?? null
  if (pairedId) {
    await supabase
      .schema("sales_mission")
      .from("board_tokens")
      .update({ revoked_at: revokedAt })
      .eq("id", pairedId)
      .eq("company_id", guard.access.companyId)
      .is("revoked_at", null)
  }

  revalidatePath(paths.settings.board)
  return { success: true }
}
