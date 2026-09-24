import { redirect } from "next/navigation"
import { rememberedView } from "@/lib/lists/remembered-view"
import { hasSeenHint } from "@/lib/hints/hint-queries"
import { listIntroKey } from "@/lib/hints/hint-key"
import { CompaniesList } from "./companies-list"

/**
 * Companies (client companies). The list itself is `CompaniesList`
 * (search, filters, sort and paging in the URL, run in the database). This
 * server half restores the remembered view: a bare /companies goes to the
 * query the person left the list with, the way Sales Activity's lists
 * reopen (see lib/lists/view-cookies.ts), and reads whether the person has
 * dismissed the list's description.
 */
export default async function CompaniesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const memory = await rememberedView("companies", params)
    if (memory.redirectTo) redirect(memory.redirectTo)
    // The description is for newcomers: once dismissed it stays closed on every device.
    const introSeen = await hasSeenHint(listIntroKey("companies"))
    return <CompaniesList fresh={memory.fresh} introSeen={introSeen} />
}
