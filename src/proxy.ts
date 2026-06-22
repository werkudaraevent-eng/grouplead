import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    // Forward the current pathname to Server Components via a request header.
    // Server Components read REQUEST headers (via next/headers `headers()`), so
    // the pathname must live on the request — not the response — or the root
    // layout can't tell it's on a public auth page and wrongly renders the
    // app shell (sidebar) over /login etc.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', request.nextUrl.pathname)

    let response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request: { headers: requestHeaders },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh the session (important for token rotation)
    const { data: { user } } = await supabase.auth.getUser()

    // Also expose pathname on the response (harmless; some tooling/debugging
    // reads it). The authoritative copy for Server Components is on the request.
    response.headers.set('x-pathname', request.nextUrl.pathname)

    // Public auth routes that must be reachable without a session.
    const publicPaths = ['/login', '/forgot-password', '/reset-password']
    const isPublicPath = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p))

    // If not authenticated and not on a public auth page, redirect to login
    if (!user && !isPublicPath) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    // If authenticated and on the login page, redirect to home. We do NOT
    // bounce away from /reset-password — a recovery session is technically
    // "authenticated" but the user is mid-reset and must be allowed to finish.
    if (user && request.nextUrl.pathname.startsWith('/login')) {
        const homeUrl = new URL('/', request.url)
        return NextResponse.redirect(homeUrl)
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public files (svg, png, jpg, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
