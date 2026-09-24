import { cookies } from "next/headers"
import { resolveRememberedView, VIEW_COOKIES, type ListKey } from "@/lib/view-cookies"

/**
 * Server side of the remembered view: the query string to redirect a bare
 * open of the list to, or null when there is nothing to restore (the
 * request already has a query, or the cookie is empty or unreadable).
 */
export async function rememberedView(list: ListKey, params: Record<string, string | string[] | undefined>): Promise<string | null> {
  return (await openListView(list, params)).query
}

/**
 * The same, and whether this is the list's first open in this browser
 * (`fresh`), which is when a saved default view may choose the view.
 */
export async function openListView(
  list: ListKey,
  params: Record<string, string | string[] | undefined>,
): Promise<{ query: string | null; fresh: boolean }> {
  const store = await cookies()
  return resolveRememberedView(list, params, store.get(VIEW_COOKIES[list])?.value)
}
