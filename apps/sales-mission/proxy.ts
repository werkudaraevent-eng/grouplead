import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { authCookieOptions } from "@/utils/supabase/cookie-options"
import { hasAuthCookie, isSignedOutError, SIGNED_OUT_REASON } from "@/lib/devices/signed-out"

/**
 * A redirect that keeps what the auth client wrote on `from`. When getUser()
 * finds the session gone (signed out from Perangkat aktif, LeadEngine, an
 * admin, a password change), auth-js removes it and @supabase/ssr answers
 * with expired session cookies on the parent domain; a bare redirect would
 * drop them and leave the dead cookie for LeadEngine to trip over too.
 */
function redirectKeepingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url)
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // GoTrue checks the token's session_id against auth.sessions here, so a
  // device signed out elsewhere is out on its next navigation.
  const hadSession = hasAuthCookie(request.cookies.getAll().map((cookie) => cookie.name))
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const signedOutElsewhere = !user && hadSession && isSignedOutError(authError)
  const loginUrl = () => {
    const url = new URL("/login", request.url)
    if (signedOutElsewhere) url.searchParams.set("reason", SIGNED_OUT_REASON)
    return url
  }
  const pathname = request.nextUrl.pathname
  // `/reset-password` must stay public: the recovery link is opened before a
  // normal session exists, and the page establishes one from the token itself.
  // `/board` likewise: a TV in the office has no session, and the page
  // authorises itself from its own token.
  // `/kalender` is the iCalendar feed: fetched by a calendar server with no
  // session; the token in its path is the credential.
  // `/jadwal` is the read-only calendar management opens without an account;
  // same rule, the token in its path is the credential.
  // /api/ai/insights/run is called by Supabase Cron with a bearer token it checks itself.
  const publicPaths = ["/login", "/forgot-password", "/reset-password", "/board", "/kalender", "/jadwal", "/api/ai/insights/run"]
  const isPublic = publicPaths.some((path) => pathname.startsWith(path))

  // The root has nothing to say to anyone. Sales Mission is an internal tool
  // reached by staff who already know what it is, so a marketing landing was
  // one screen standing between them and the thing they came for. Redirected
  // here rather than from a page component: `user` is already resolved, so it
  // costs no extra round trip and nothing renders before the bounce.
  if (pathname === "/") {
    return redirectKeepingCookies(user ? new URL("/workspace", request.url) : loginUrl(), response)
  }

  if (!user && !isPublic) return redirectKeepingCookies(loginUrl(), response)

  // Bouncing a signed-in user off /login would loop when the workspace itself
  // sent them here: the session is shared with LeadEngine, so someone without
  // Sales Mission permission arrives authenticated, gets rejected by the
  // workspace layout, and would be thrown straight back at it. Keep /login
  // reachable whenever it carries an error to show.
  const hasAuthError = request.nextUrl.searchParams.has("error")
  if (user && pathname.startsWith("/login") && !hasAuthError) {
    return NextResponse.redirect(new URL("/workspace", request.url))
  }

  return response
}

export const config = {
  // The web manifest, the service worker and the icons are fetched by the
  // browser itself, often without cookies (a manifest request carries none
  // unless the link says use-credentials). Sent through the session check
  // they were redirected to /login, so the manifest arrived as HTML and the
  // worker never installed. They hold nothing private; the proxy skips them.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
