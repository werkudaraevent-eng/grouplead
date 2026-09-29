/**
 * Settings › Users › Sign out everywhere, in words. The database decides
 * (`public.fn_admin_sign_out_user`: the `members` update grant in a unit the
 * person belongs to, or in a holding company; only a super admin for a super
 * admin; never one's own account) and raises a short code; this turns the
 * code and the count into what the admin reads.
 */

export function adminSignOutErrorMessage(message: string | null | undefined): string {
    switch (message) {
        case "forbidden":
            return "You can sign out only people in a business unit where you manage users. A super admin can be signed out only by a super admin."
        case "self":
            return "To sign yourself out elsewhere, use Active devices on your own profile."
        case "not_authenticated":
            return "Your session has ended. Sign in again, then try again."
        case "user_required":
            return "Pick a user first."
        default:
            return "This person could not be signed out. Try again."
    }
}

export function adminSignOutSuccessMessage(name: string, ended: number): string {
    if (ended === 0) return `${name} was not signed in anywhere`
    return `${name} is signed out of ${ended === 1 ? "1 device" : `${ended} devices`}`
}
