import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { authCookieOptions } from "@/utils/supabase/cookie-options"

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

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  // `/reset-password` must stay public: the recovery link is opened before a
  // normal session exists, and the page establishes one from the token itself.
  // `/board` likewise: a TV in the office has no session, and the page
  // authorises itself from its own token.
  const publicPaths = ["/login", "/forgot-password", "/reset-password", "/board"]
  const isPublic = publicPaths.some((path) => pathname.startsWith(path))

  // The root has nothing to say to anyone. Sales Mission is an internal tool
  // reached by staff who already know what it is, so a marketing landing was
  // one screen standing between them and the thing they came for. Redirected
  // here rather than from a page component: `user` is already resolved, so it
  // costs no extra round trip and nothing renders before the bounce.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(user ? "/workspace" : "/login", request.url))
  }

  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url))

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
