import { COMPANY_LIST } from "./company-list"
import { CONTACT_LIST } from "./contact-list"
import { urlSpecOf, type ListKey } from "./list-plan"
import { isBareRequest, parseListState, rememberedQuery } from "./list-state"

/**
 * A list remembers how you last looked at it, as Sales Activity's lists do
 * (`lib/view-cookies.ts` there): one cookie per list holding the list's own
 * query string without page or size, written by the browser whenever the
 * view changes and read by the server when the list is opened with no query
 * at all, which then redirects to it. The URL stays honest and shareable; a
 * stale or hand-edited cookie goes through the list's own parser, so it can
 * never carry anything the URL could not. "Clear all" writes it empty.
 */

export const VIEW_COOKIES: Record<ListKey, string> = {
    contacts: "le-view-contacts",
    companies: "le-view-companies",
}

export const LIST_PATHS: Record<ListKey, string> = {
    contacts: "/contacts",
    companies: "/companies",
}

const SPECS = { contacts: CONTACT_LIST, companies: COMPANY_LIST } as const

/** A query string the list's own parser accepts, with page and size dropped; "" when nothing is set. */
export function sanitizeViewString(list: ListKey, raw: string): string {
    const spec = urlSpecOf(SPECS[list])
    return rememberedQuery(parseListState(new URLSearchParams(raw), spec), spec)
}

/**
 * What a request for the list should do with the memory: redirect to the
 * remembered query (a bare open with something remembered), or render.
 * `fresh` is a bare open with no memory at all, the first visit on this
 * browser, the one moment a saved default view may choose the view.
 */
export function resolveRememberedView(
    list: ListKey,
    params: Record<string, string | string[] | undefined>,
    cookie: string | undefined,
): { redirectTo: string | null; fresh: boolean } {
    if (!isBareRequest(params)) return { redirectTo: null, fresh: false }
    if (cookie === undefined) return { redirectTo: null, fresh: true }
    let decoded = cookie
    try {
        decoded = decodeURIComponent(cookie)
    } catch {
        // Left as is; the parser drops what it cannot read.
    }
    const qs = sanitizeViewString(list, decoded)
    return { redirectTo: qs ? `${LIST_PATHS[list]}?${qs}` : null, fresh: false }
}
