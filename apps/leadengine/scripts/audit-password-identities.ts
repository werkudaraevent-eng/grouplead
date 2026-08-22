/**
 * Microsoft sign-in removal: find accounts that cannot log in with a password.
 *
 * Users created through Azure have only an `azure` identity. Once the Microsoft
 * button is gone they have no way in until they set a password, so this script
 * reports them and — with --send — emails each one a recovery link they use to
 * choose their own password.
 *
 * Recovery links are used deliberately instead of assigning temporary
 * passwords: no admin ever sees or transmits a credential, and the user ends up
 * with a secret only they know.
 *
 * Run the audit BEFORE deploying the removal, and only deploy once the
 * "cannot sign in" count reaches zero.
 *
 * Heads-up on email limits: Supabase's built-in SMTP is rate-limited to a
 * handful of messages per hour, so --send will start failing part-way through
 * on a real team. Configure a custom SMTP provider first, or fetch links
 * individually with `supabase.auth.admin.generateLink({ type: 'recovery' })`
 * and hand them out through a channel you trust — a recovery link is itself a
 * credential until it is used.
 *
 * Usage:
 *   npx tsx scripts/audit-password-identities.ts           # report only
 *   npx tsx scripts/audit-password-identities.ts --send    # also email recovery links
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

const SEND = process.argv.includes('--send')

/** Where the recovery link lands. Must be in the Supabase Redirect URLs allow-list. */
const REDIRECT_TO = process.env.PASSWORD_RESET_REDIRECT_URL || 'http://localhost:3000/reset-password'

type AuthUser = {
    id: string
    email?: string
    identities?: { provider: string }[] | null
}

async function listAllUsers(): Promise<AuthUser[]> {
    const users: AuthUser[] = []
    // listUsers paginates at 50 by default; walk until a short page comes back.
    for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
        if (error) throw error
        users.push(...(data.users as AuthUser[]))
        if (data.users.length < 200) break
    }
    return users
}

async function main() {
    const users = await listAllUsers()

    const withPassword: AuthUser[] = []
    const withoutPassword: AuthUser[] = []

    for (const user of users) {
        const providers = (user.identities ?? []).map((identity) => identity.provider)
        // Supabase records password credentials as an `email` identity.
        if (providers.includes('email')) withPassword.push(user)
        else withoutPassword.push(user)
    }

    console.log(`Total users:            ${users.length}`)
    console.log(`Can sign in w/ password: ${withPassword.length}`)
    console.log(`CANNOT sign in:          ${withoutPassword.length}`)

    if (withoutPassword.length === 0) {
        console.log('\nEvery account has a password. Safe to remove Microsoft sign-in.')
        return
    }

    console.log('\nAccounts that would be locked out:')
    for (const user of withoutPassword) {
        const providers = (user.identities ?? []).map((identity) => identity.provider).join(', ') || 'none'
        console.log(`  ${user.email ?? '(no email)'}  [${providers}]`)
    }

    if (!SEND) {
        console.log('\nDry run. Re-run with --send to email each of them a password-setup link.')
        return
    }

    console.log(`\nSending recovery links (redirect: ${REDIRECT_TO})…`)
    let sent = 0
    let failed = 0

    for (const user of withoutPassword) {
        if (!user.email) {
            console.log(`  SKIP ${user.id} — no email address on the account`)
            failed += 1
            continue
        }

        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: REDIRECT_TO,
        })

        if (error) {
            console.log(`  FAIL ${user.email} — ${error.message}`)
            failed += 1
        } else {
            console.log(`  SENT ${user.email}`)
            sent += 1
        }
    }

    console.log(`\nSent: ${sent}   Failed: ${failed}`)
    if (failed > 0) console.log('Resolve the failures before removing Microsoft sign-in.')
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
