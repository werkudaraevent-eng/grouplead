import { cookies } from "next/headers"
import { isBareRequest, sanitizeViewString, VIEW_COOKIES, type ListKey } from "@/lib/view-cookies"

/**
 * Server side of the remembered view: the query string to redirect a bare
 * open of the list to, or null when there is nothing to restore (the
 * request already has a query, or the cookie is empty or unreadable).
 */
export async function rememberedView(list: ListKey, params: Record<string, string | string[] | undefined>): Promise<string | null> {
  if (!isBareRequest(params)) return null
  const store = await cookies()
  const raw = store.get(VIEW_COOKIES[list])?.value
  if (!raw) return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // Left as is; the parser drops what it cannot read.
  }
  const qs = sanitizeViewString(list, decoded)
  return qs || null
}
