"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

/** Sign out, from the drawer's account menu or the phone's More sheet. */
export function useSignOut() {
    const router = useRouter()
    const [signingOut, setSigningOut] = useState(false)

    const signOut = async () => {
        setSigningOut(true)
        // This device only. The client's default ends every session of the
        // account, which signed the person out of their phone whenever they
        // left the laptop; other devices are Active devices' to end.
        await createClient().auth.signOut({ scope: "local" })
        router.push("/login")
        router.refresh()
    }

    return { signOut, signingOut }
}
