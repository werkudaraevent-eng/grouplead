import type { CookieOptions } from '@supabase/ssr'

/**
 * Auth cookie options shared by the browser, server, and proxy clients.
 *
 * LeadEngine and Sales Mission run on one Supabase project, so they already
 * share `auth.users` and the Entra provider. The session cookie is the missing
 * half: Supabase scopes it to the host that set it, so a login on
 * `crm.werkudara.com` is invisible to `mission.werkudara.com`. Setting an
 * explicit parent domain lets both subdomains read the same session.
 *
 * Local dev leaves this unset and still behaves as if SSO worked, because
 * cookies ignore the port — `localhost:3000` and `localhost:3001` share a jar.
 * That makes a missing value a production-only failure, so set
 * `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` in every deployed environment.
 *
 * Both apps must use the same value or they will write two separate cookies.
 */
export function authCookieOptions(): CookieOptions | undefined {
    const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim()
    if (!domain) return undefined

    return { domain, path: '/', sameSite: 'lax', secure: true }
}
