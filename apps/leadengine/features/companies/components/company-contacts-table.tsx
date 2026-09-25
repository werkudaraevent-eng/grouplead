"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/shared/search-field"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { OUTLINED_BUTTON, RecordCard } from "@/components/shared/record-page"
import { ChevronLeft, ChevronRight, Plus } from "@/components/icons"
import { useRowLink } from "@/hooks/use-row-link"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { mailtoHref, telHref } from "@/lib/record-page"
import { nameWithSalutation } from "@/features/contacts/lib/contact-record"
import type { CompanyContact } from "./company-detail-page"

const PAGE_SIZE = 10

/**
 * A company's Contacts tab: one card titled Contacts with Add contact at
 * its trailing edge (for whoever may create one, the company filled in),
 * then its people ten at a time: a table from `md` (the Data table's
 * sentence-case headers, 52dp rows, the row opening the contact, the email
 * and phone links of their own), one row per person with their job title
 * and email under the name on a phone. The search appears once there is
 * more than a page of them.
 */
export function CompanyContactsTable({ contacts, onAdd }: { contacts: readonly CompanyContact[]; onAdd?: () => void }) {
    const rowLink = useRowLink()
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(0)
    const onSearch = useCallback((value: string) => { setSearch(value); setPage(0) }, [])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return contacts
        return contacts.filter((contact) =>
            [contact.full_name, contact.job_title, contact.email].some((value) => value?.toLowerCase().includes(query)),
        )
    }, [contacts, search])
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const current = Math.min(page, pages - 1)
    const shown = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

    return (
        <RecordCard
            title="Contacts"
            headingId="contacts-tab-heading"
            action={onAdd ? (
                <Button variant="outline" onClick={onAdd} className={`${OUTLINED_BUTTON} -my-1.5 max-lg:h-10`}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add contact
                </Button>
            ) : undefined}
        >
            {contacts.length === 0 ? (
                <p className="px-4 py-5 text-[13px] text-muted-foreground">No contacts yet. A contact whose company is this one shows here.</p>
            ) : (
                <>
                    {contacts.length > PAGE_SIZE && (
                        <div className="px-4 py-3">
                            <SearchField value={search} onChange={onSearch} aria-label="Search contacts" placeholder="Search name, job title or email" className="w-full md:max-w-xs" />
                        </div>
                    )}
                    {shown.length === 0 ? (
                        <p className="border-t border-border px-4 py-5 text-[13px] text-muted-foreground">No contacts match “{search.trim()}”.</p>
                    ) : (
                        <>
                            <table className="w-full table-fixed text-left text-sm max-md:hidden">
                                <colgroup>
                                    <col />
                                    <col className="w-[22%]" />
                                    <col className="w-[28%]" />
                                    <col className="w-44" />
                                </colgroup>
                                <thead className="bg-muted">
                                    <tr className="h-10 text-sm text-muted-foreground">
                                        <th scope="col" className="px-4 font-medium">Name</th>
                                        <th scope="col" className="px-3 font-medium">Job title</th>
                                        <th scope="col" className="px-3 font-medium">Email</th>
                                        <th scope="col" className="px-3 font-medium">Phone</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {shown.map((contact) => {
                                        const mailto = mailtoHref(contact.email)
                                        const tel = telHref(contact.phone)
                                        return (
                                            <tr key={contact.id} onClick={rowLink(`/contacts/${contact.id}`)} className="h-13 cursor-pointer transition-colors hover:bg-muted/60">
                                                <td className="px-4">
                                                    <span className="flex min-w-0 items-center gap-3">
                                                        <InitialsAvatar name={contact.full_name} size="md" />
                                                        <Link href={`/contacts/${contact.id}`} className="truncate font-semibold text-foreground hover:text-primary hover:underline">
                                                            {nameWithSalutation(contact.salutation, contact.full_name)}
                                                        </Link>
                                                    </span>
                                                </td>
                                                <td className="truncate px-3">{contact.job_title || <span className="text-muted-foreground">—</span>}</td>
                                                <td className="truncate px-3">
                                                    {mailto ? <a href={mailto} className="font-medium text-primary hover:underline" title={contact.email ?? undefined}>{contact.email}</a> : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="truncate px-3 tabular-nums">
                                                    {tel && contact.phone ? <a href={tel} className="font-medium text-primary hover:underline">{formatPhoneDisplay(contact.phone)}</a> : <span className="text-muted-foreground">—</span>}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            <ul className="divide-y divide-border md:hidden">
                                {shown.map((contact) => (
                                    <li key={contact.id}>
                                        <Link href={`/contacts/${contact.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60">
                                            <InitialsAvatar name={contact.full_name} size="md" />
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="truncate text-sm font-semibold text-foreground">{nameWithSalutation(contact.salutation, contact.full_name)}</span>
                                                <span className="truncate text-[13px] text-muted-foreground">{[contact.job_title, contact.email].filter(Boolean).join(" · ") || "No job title"}</span>
                                            </span>
                                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    {filtered.length > PAGE_SIZE && (
                        <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-3">
                            <span className="mr-2 text-xs tabular-nums text-muted-foreground">
                                {current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length}
                            </span>
                            <Button variant="ghost" size="icon-sm" aria-label="Previous contacts" disabled={current === 0} onClick={() => setPage(current - 1)} className="hover:bg-muted pointer-coarse:size-10">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" aria-label="Next contacts" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="hover:bg-muted pointer-coarse:size-10">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </RecordCard>
    )
}
