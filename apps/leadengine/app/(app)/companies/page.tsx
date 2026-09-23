import { redirect } from "next/navigation"
import { rememberedView } from "@/lib/lists/remembered-view"
import { CompaniesList } from "./companies-list"

/**
 * Companies (client companies). The list itself is `CompaniesList`
 * (search, filters, sort and paging in the URL, run in the database). This
 * server half only restores the remembered view: a bare /companies goes to
 * the query the person left the list with, the way Sales Activity's lists
 * reopen (see lib/lists/view-cookies.ts).
 */
export default async function CompaniesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const memory = await rememberedView("companies", params)
    if (memory.redirectTo) redirect(memory.redirectTo)
    return <CompaniesList fresh={memory.fresh} />
}
