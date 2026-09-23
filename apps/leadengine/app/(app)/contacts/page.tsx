import { redirect } from "next/navigation"
import { rememberedView } from "@/lib/lists/remembered-view"
import { ContactsList } from "./contacts-list"

/**
 * Contacts. The list itself is `ContactsList` (search, filters, sort and
 * paging in the URL, run in the database). This server half only restores
 * the remembered view: a bare /contacts goes to the query the person left
 * the list with, the way Sales Activity's lists reopen (see
 * lib/lists/view-cookies.ts).
 */
export default async function ContactsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const memory = await rememberedView("contacts", params)
    if (memory.redirectTo) redirect(memory.redirectTo)
    return <ContactsList fresh={memory.fresh} />
}
