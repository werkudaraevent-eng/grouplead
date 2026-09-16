"use client"

/**
 * A UI preference the server may read on the next request, and the other
 * Werkudara app may read too.
 *
 * localStorage is per origin and invisible to the server, so a preference
 * kept only there is applied after hydration: the sidebar mounts at its
 * default width and snaps to the stored one a frame later. A cookie on the
 * parent domain is in the first request, so the first HTML is already
 * right, and it carries across crm. and mission. the way the shared session
 * does. Same domain rule as `active_company` in LeadEngine's company
 * context: explicit config wins; otherwise the parent of a three-label
 * host; localhost gets no domain attribute.
 */
export function writePreferenceCookie(name: string, value: string) {
  const configured = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim()
  const labels = location.hostname.split(".")
  const domain = configured || (labels.length >= 3 && !/^[\d.]+$/.test(location.hostname) ? `.${labels.slice(-2).join(".")}` : "")
  const secure = location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${domain ? `; Domain=${domain}` : ""}${secure}`
}

/** Whether the browser already carries this preference as a cookie. */
export function hasPreferenceCookie(name: string): boolean {
  return document.cookie.split("; ").some((part) => part.startsWith(`${name}=`))
}
