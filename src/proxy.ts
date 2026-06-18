import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
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
                        request: { headers: request.headers },
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

    // Set pathname header for layout to read
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
