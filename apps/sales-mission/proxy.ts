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
  const publicPaths = ["/login", "/forgot-password", "/reset-password"]
  const isPublic = pathname === "/" || publicPaths.some((path) => pathname.startsWith(path))

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
