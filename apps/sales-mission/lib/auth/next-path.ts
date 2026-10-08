/**
 * Where to go after signing in.
 *
 * A link opened without a session (a file link in an exported workbook, a
 * notification, a bookmark) used to land on /login and then on Hari ini, so
 * the person had to find the thing again by hand. The proxy now carries the
 * address in `?next=` and the login page, and the proxy's own bounce of a
 * signed-in visitor off /login, go back to it.
 *
 * `next` is read from the address bar, which anyone can write, so it is an
 * open redirect unless it is pinned down: only a path inside this app's
 * workspace is honoured, and only as a path, never as an address that could
 * resolve to another origin ("//evil.example", "/\evil.example", a tab or a
 * newline the URL parser drops, dot segments that climb out of /workspace).
 * Anything else falls back to the workspace. Pure, so the proxy, the login
 * page and the tests agree.
 */

export const NEXT_PARAM = "next"

/** Every page and file that needs a session lives here; nothing else is a place to return to. */
const WORKSPACE = "/workspace"

/** Long enough for any list filter; a longer value is not an address the app wrote. */
const NEXT_MAX_LENGTH = 2048

/** The router's own cache-busting parameter: part of a navigation request, never of an address. */
const ROUTER_PARAMS = ["_rsc"]

const PROBE_ORIGIN = "https://same-origin.invalid"

/**
 * `value` as a same-origin workspace path to return to after signing in, or
 * null when it is missing or not one to trust.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > NEXT_MAX_LENGTH) return null
  // Only a path: one leading slash, no scheme, no authority. A backslash or a
  // control character is refused anywhere, because browsers read "\" as "/"
  // and strip tabs and newlines before resolving.
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null

  let url: URL
  try {
    url = new URL(value, PROBE_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== PROBE_ORIGIN) return null
  if (url.pathname !== WORKSPACE && !url.pathname.startsWith(`${WORKSPACE}/`)) return null

  // Returned as the parser resolved it, not as written: dot segments are
  // already collapsed, so what was checked is what the browser will open.
  return `${url.pathname}${withoutRouterParams(url.search)}${url.hash}`
}

/**
 * The query without the router's own parameters, every other pair left
 * exactly as written: re-serialising through URLSearchParams would encode
 * the slashes of a file link's path and change the address.
 */
function withoutRouterParams(search: string): string {
  const kept = search
    .slice(1)
    .split("&")
    .filter((pair) => pair !== "" && !ROUTER_PARAMS.includes(pair.split("=", 1)[0]))
  return kept.length > 0 ? `?${kept.join("&")}` : ""
}

/**
 * The address the proxy sends a visitor without a session to: /login, with
 * the place they were going when it is one to come back to.
 */
export function loginPathFor(pathname: string, search: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra)
  const next = safeNextPath(`${pathname}${search}`)
  if (next) params.set(NEXT_PARAM, next)
  const query = params.toString()
  return query ? `/login?${query}` : "/login"
}
