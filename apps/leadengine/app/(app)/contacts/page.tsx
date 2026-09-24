import { redirect } from "next/navigation"
import { rememberedView } from "@/lib/lists/remembered-view"
import { hasSeenHint } from "@/lib/hints/hint-queries"
import { listIntroKey } from "@/lib/hints/hint-key"
import { ContactsList } from "./contacts-list"

/**
 * Contacts. The list itself is `ContactsList` (search, filters, sort and
 * paging in the URL, run in the database). This server half restores
 * the remembered view: a bare /contacts goes to the query the person left
 * the list with, the way Sales Activity's lists reopen (see
 * lib/lists/view-cookies.ts), and reads whether the person has dismissed
 * the list's description.
 */
export default async function ContactsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const memory = await rememberedView("contacts", params)
    if (memory.redirectTo) redirect(memory.redirectTo)
    // The description is for newcomers: once dismissed it stays closed on every device.
    const introSeen = await hasSeenHint(listIntroKey("contacts"))
    return <ContactsList fresh={memory.fresh} introSeen={introSeen} />
}
