import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { createServiceClient } from "@/utils/supabase/service"

/**
 * Token handling for the TV board.
 *
 * The board is opened by a screen, not a person, so there is no session and RLS
 * has nothing to evaluate. Authorisation is therefore the token itself, and the
 * company it resolves to is the only scope every subsequent query may use.
 */

/** Tokens are compared by hash, so the plaintext is never stored anywhere. */
export function hashBoardToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Generate a token. Returned once to the admin and never recoverable after. */
export function generateBoardToken(): { token: string; hash: string } {
  // URL-safe: the token travels in a query string that someone types into a TV.
  const token = randomBytes(24).toString("base64url")
  return { token, hash: hashBoardToken(token) }
}

/**
 * Constant-time comparison of two hex digests.
 *
 * The lookup below is by hash, so an attacker cannot time the database — but
 * comparing digests with `===` anywhere in this path would leak information as
 * soon as someone refactors the lookup into a scan.
 */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex")
  const right = Buffer.from(b, "hex")
  if (left.length !== right.length || left.length === 0) return false
  return timingSafeEqual(left, right)
}

/**
 * What a link opens. A screen link is for the TV; a calendar link is the
 * read-only month calendar management opens in a browser. Two links, because
 * one of them belongs on a wall and the other in an inbox, and because a link
 * handed out for one purpose should not quietly work for the other.
 */
export type BoardTokenKind = "screen" | "calendar"

export const BOARD_TOKEN_KINDS: readonly BoardTokenKind[] = ["screen", "calendar"] as const

export const BOARD_TOKEN_KIND_LABELS: Record<BoardTokenKind, string> = {
  screen: "Layar TV",
  calendar: "Kalender manajemen",
}

/** The public URL a link of each kind is opened at. */
export function boardTokenUrl(baseUrl: string, kind: BoardTokenKind, token: string): string {
  return kind === "calendar"
    ? `${baseUrl}/jadwal/${encodeURIComponent(token)}`
    : `${baseUrl}/board?token=${encodeURIComponent(token)}`
}

export interface BoardTokenResolution {
  companyId: string
  tokenId: string
  label: string
  kind: BoardTokenKind
  /** Bound to the link when it was made; the URL cannot change it. */
  showClientNames: boolean
  /** Same rule: whether reported visits show their outcome on the wall. */
  showOutcomes: boolean
}

/**
 * Resolve a raw token to the tenant it may display.
 *
 * Returns null for anything not currently usable — unknown, revoked, expired,
 * or of the wrong kind — without distinguishing between them. Telling a caller
 * which of those it was would confirm that a token once existed.
 */
export async function resolveBoardToken(token: string, kind: BoardTokenKind): Promise<BoardTokenResolution | null> {
  const trimmed = token.trim()
  if (!trimmed) return null

  const supabase = createServiceClient()
  const hash = hashBoardToken(trimmed)

  const { data } = await supabase
    .schema("sales_mission")
    .from("board_tokens")
    .select("id, company_id, label, kind, token_hash, expires_at, revoked_at, show_client_names, show_outcomes")
    .eq("token_hash", hash)
    .maybeSingle()

  if (!data) return null
  if (!hashesMatch(data.token_hash as string, hash)) return null
  if (data.revoked_at) return null
  // Rows written before the column existed are screen links.
  if (((data.kind as string | null) ?? "screen") !== kind) return null

  const expiresAt = data.expires_at as string | null
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return null

  // Best-effort: knowing when a screen last rendered helps an admin spot a
  // token that should be revoked. Failing to record it must not break the board.
  await supabase
    .schema("sales_mission")
    .from("board_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)

  return {
    companyId: data.company_id as string,
    tokenId: data.id as string,
    label: data.label as string,
    kind,
    showClientNames: data.show_client_names === true,
    showOutcomes: data.show_outcomes === true,
  }
}
