"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"

/** Sign out, from the drawer's account menu or the phone's More sheet. */
export function useSignOut() {
    const router = useRouter()
    const [signingOut, setSigningOut] = useState(false)

    const signOut = async () => {
        setSigningOut(true)
        // Clear the shared session id too — leaving it behind would make the
        // sibling app compare against an id this browser no longer owns.
        clearActiveSessionId()
        await createClient().auth.signOut()
        router.push("/login")
        router.refresh()
    }

    return { signOut, signingOut }
}
