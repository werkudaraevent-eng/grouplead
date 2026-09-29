"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "@/components/icons"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { signOutUserEverywhereAction } from "@/app/actions/user-actions"
import { adminSignOutSuccessMessage } from "@/lib/devices/admin-sign-out"
import type { Profile } from "@/types"

/**
 * Settings › Users › a user's panel › Sessions: sign this person out of every
 * device at once, in LeadEngine and Sales Activity, for a lost phone or
 * someone leaving. Behind the grant the other account actions ask for
 * (`members` update); the database checks it again, with the unit. Not
 * shown on one's own account, where Active devices on the profile is the
 * door. Confirmed, because it cannot be undone from here.
 */
export function SignOutEverywhereSection({ profile }: { profile: Profile }) {
    const [open, setOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const [myId, setMyId] = useState<string | null>(null)

    // Only to hide the section on one's own account; the server refuses it anyway.
    useEffect(() => {
        let active = true
        createClient().auth.getSession().then(({ data }) => {
            if (active) setMyId(data.session?.user.id ?? null)
        })
        return () => { active = false }
    }, [])

    if (myId === null || myId === profile.id) return null
    const name = profile.full_name || profile.email || "This person"

    const confirm = async () => {
        setPending(true)
        const result = await signOutUserEverywhereAction(profile.id)
        setPending(false)
        if (result.success) {
            toast.success(adminSignOutSuccessMessage(name, result.data?.count ?? 0))
            setOpen(false)
        } else {
            toast.error(result.error || "This person could not be signed out. Try again.")
        }
    }

    return (
        <PermissionGate resource="members" action="update">
            <section className="space-y-3" aria-labelledby="user-sessions-heading">
                <h3 id="user-sessions-heading" className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                    Sessions
                </h3>
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                    <p className="text-sm text-muted-foreground">
                        For a lost phone or someone leaving: signs this person out of every device at once. Their data stays; they can sign in again unless you deactivate the account.
                    </p>
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
                        Sign out everywhere
                    </Button>
                </div>
            </section>

            <AlertDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Sign {name} out everywhere?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {name} leaves LeadEngine and Sales Activity on every device at once, and anything not yet saved there is lost. They can sign in again with their password unless you also deactivate the account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={pending}
                            onClick={(event) => { event.preventDefault(); confirm() }}
                            variant="destructive"
                        >
                            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Sign out everywhere
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </PermissionGate>
    )
}
