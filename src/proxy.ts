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
    // OAuth callback must be reachable before a local Supabase session exists.
    // Otherwise the proxy redirects the provider callback back to /login and
    // the route handler never gets a chance to exchange the authorization code.
    const publicPaths = ['/login', '/forgot-password', '/reset-password', '/auth/callback']
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

    // ── Maintenance mode (full lockdown) ────────────────────────────────────
    // When enabled, everyone EXCEPT super_admin is redirected to /maintenance.
    // Runs only for authenticated users on non-public pages (public auth pages
    // already returned above). FAIL-OPEN: any error reading the flag or the
    // role is treated as "not in maintenance" so a transient DB hiccup can
    // never lock the whole platform — including admins — out by accident.
    const isMaintenancePage = request.nextUrl.pathname.startsWith('/maintenance')
    if (user && !isPublicPath) {
        try {
            const { data: settings } = await supabase
                .from('app_settings')
                .select('maintenance_enabled')
                .eq('id', 1)
                .maybeSingle()

            if (settings?.maintenance_enabled) {
                // Resolve role; super_admin bypasses the lockdown entirely.
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle()
                const role = (profile?.role ?? '').toLowerCase().replace(/\s+/g, '_')
                const isSuperAdmin = role === 'super_admin'

                if (!isSuperAdmin && !isMaintenancePage) {
                    // Non-admin during maintenance → send to the holding page.
                    return NextResponse.redirect(new URL('/maintenance', request.url))
                }
                // Super admin landing on /maintenance has no reason to stay —
                // bounce them back to the app so they can keep working.
                if (isSuperAdmin && isMaintenancePage) {
                    return NextResponse.redirect(new URL('/', request.url))
                }
            } else if (isMaintenancePage) {
                // Maintenance is OFF but someone hit /maintenance directly —
                // send them back into the app.
                return NextResponse.redirect(new URL('/', request.url))
            }
        } catch {
            // Fail-open: ignore and let the request proceed normally.
        }
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
