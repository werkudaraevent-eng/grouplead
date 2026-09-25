"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageChrome, type ChromeMenuItem } from "@/components/layout/page-chrome"
import { createClient } from "@/utils/supabase/client"
import { deleteClientCompaniesAction, updateClientCompanyAction } from "@/app/actions/company-actions"
import { usePermissions } from "@/contexts/permissions-context"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { NeedsDetailsMark } from "@/components/shared/status-badge"
import { PermissionMenuItem } from "@/components/shared/permission-menu-item"
import {
    FieldRow, InlineChoiceField, InlineCustomSelectField, InlineSelectField, InlineTextField, type ChoiceOption,
} from "@/components/shared/inline-edit-field"
import {
    AboutCard, AddNoteRow, CardAction, FactNone, FILLED_BUTTON, HeaderLinkButton, KeyFact, KeyFactsCard,
    MORE_BUTTON, OUTLINED_BUTTON, PersonLine, QuickAction, RecordFact, RecordHeader, RecordHero, RecordLeadsCard,
    RecordPanel, RecordStepper, RecordTabs, RECORD_TYPE, RelatedListCard, type RecordLead, type RecordTab,
} from "@/components/shared/record-page"
import { ActivityComposer, ComposerSheet, type ComposerEnv } from "@/components/shared/record-composer"
import { RecordActivityFeed } from "@/components/shared/record-activity-feed"
import { RecordFiles } from "@/components/shared/record-files"
import { RecordLeadsTable } from "@/components/shared/record-leads-table"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"
import { nameWithSalutation } from "@/features/contacts/lib/contact-record"
import { NewLeadSheet } from "@/features/leads/components/new-lead-sheet"
import { companyActivityTarget, useRecordActivity, useRecordAssignees } from "@/hooks/use-record-activity"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { cn } from "@/lib/utils"
import {
    buildFeed, externalHref, formatCalendarDay, formatDayTime, isBlank, lastActivityLabel, splitAboutFields, telHref,
    websiteLabel, type ActivityRow, type NoteRow, type PeopleById,
} from "@/lib/record-page"
import type { RecordViewer } from "@/lib/record-activity"
import { ChevronLeft, ChevronRight, FileText, Globe, Loader2, MoreVertical, Pencil, Phone, Plus, Trash2 } from "@/components/icons"
import type { ClientCompany } from "@/types"
import {
    companyAddress, companyCardLine, companyGroupTitle, companySupportingLine, withCompanyTab, type CompanyTab,
} from "../lib/company-record"
import { AddCompanyModal } from "./add-company-modal"
import { CompanyContactsTable } from "./company-contacts-table"

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface RelatedCompany {
    id: string
    name: string
    industry?: string | null
    line_industry?: string | null
    city?: string | null
    area?: string | null
}

interface CompanyData extends Omit<ClientCompany, "parent"> {
    parent?: RelatedCompany | null
    owner?: { id: string; full_name: string; email: string; avatar_url?: string | null } | null
    updated_at?: string | null
    company_id?: string | null
}

/** One of the company's people, as its Contacts card and tab list them. */
export interface CompanyContact {
    id: string
    salutation: string | null
    full_name: string
    job_title: string | null
    email: string | null
    phone: string | null
}

interface CompanyDetailPageProps {
    company: CompanyData
    leads: RecordLead[]
    contacts: CompanyContact[]
    /** The company's timeline, newest first. */
    activities: ActivityRow[]
    /** The company's notes, newest first. */
    notes: NoteRow[]
    /** The people the timeline names beyond its authors: assignees, who ticked a follow-up done. */
    people: PeopleById
    /** Who is looking: their id, name and whether they are an admin (what they may edit and tick). */
    viewer: RecordViewer
    fileCount: number | null
    subsidiaries?: RelatedCompany[]
    lastModified?: string
    lastModifiedBy?: string
    nextCompanyId?: string
    prevCompanyId?: string
    initialTab?: CompanyTab
}

/** One property in About this company, with whether it is empty and whether a person fills it in. */
interface InfoField {
    key: string
    empty: boolean
    fillable: boolean
    node: ReactNode
}

// ═══════════════════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════════════════

/**
 * A company's record page, the Contact's approved design applied to an
 * organisation (DESIGN.md, "Record pages"). One scroll in the shell's
 * `<main>`:
 *
 *   desk (lg+)  the header: back (←, "Back to Companies"), a 48dp tile,
 *               name, sector · line industry · city, ‹ › Call Edit New
 *               lead ⋮; the facts: Owner, Phone, Website, Last activity
 *               tabs pinned to the top: Activity · Contacts n · Leads n ·
 *               Files n
 *               Activity: the composer, Upcoming (open follow-ups) and
 *               History; beside them (380px) About this company, Contacts,
 *               Leads, the group. Contacts, Leads and Files take the whole
 *               width
 *   phone       the top app bar ("Company", back, ⋮ Edit / ‹ › / Delete)
 *               the header centred, then Call · Website · Note
 *               tabs pinned under the top app bar; Activity: Key facts,
 *               Add a note…, Upcoming, History, then the group and About
 *               this company
 *
 * The phone, the website and the owner are edited in the facts, where they
 * show, and About holds them only while they are empty, so nothing is said
 * twice.
 */
export function CompanyDetailPage({
    company, leads, contacts, activities, notes, people, viewer, fileCount, subsidiaries = [], lastModified, lastModifiedBy,
    nextCompanyId, prevCompanyId, initialTab = "activity",
}: CompanyDetailPageProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const { isHoldingView, companies } = useCompany()
    const canEdit = can("companies", "update")
    const canDelete = can("companies", "delete")
    const canCreateLead = can("leads", "create")
    const canCreateContact = can("contacts", "create")

    const [tab, setTab] = useState<CompanyTab>(initialTab)
    // The Files tab loads its list when first opened, and is kept after.
    const [filesSeen, setFilesSeen] = useState(initialTab === "files")
    const [editOpen, setEditOpen] = useState(false)
    const [addContactOpen, setAddContactOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [composerOpen, setComposerOpen] = useState(false)
    const [newLeadOpen, setNewLeadOpen] = useState(false)
    const [filesCount, setFilesCount] = useState<number | null>(fileCount)
    const [ownerOptions, setOwnerOptions] = useState<ChoiceOption[] | null>(null)
    const tabsAnchorRef = useRef<HTMLDivElement>(null)

    // ─── Facts ─────────────────────────────────────────────
    const owner = company.owner ?? null
    const tel = telHref(company.phone)
    const website = company.website?.trim() ? externalHref(company.website.trim()) : null
    const supporting = companySupportingLine(company)
    const address = companyAddress(company)
    const unitName = companies.find((unit) => unit.id === company.company_id)?.name ?? null
    const unitShown = !!unitName && (isHoldingView || companies.length > 1)
    const feed = useMemo(() => buildFeed(activities, notes, people), [activities, notes, people])
    const lastActivity = lastActivityLabel(feed)
    const target = useMemo(() => companyActivityTarget(company.id), [company.id])
    const { log, ...activityActions } = useRecordActivity(target)
    const { assignees, loadAssignees } = useRecordAssignees(target)
    const composerEnv: ComposerEnv = {
        subject: company.name,
        viewer: { id: viewer.id, isAdmin: viewer.isAdmin },
        viewerName: viewer.name,
        assignees,
        loadAssignees,
    }
    const parent = company.parent?.id ? company.parent : null
    const groupTitle = companyGroupTitle(!!parent, subsidiaries.length)

    const openEdit = () => setEditOpen(true)
    const openNewLead = canCreateLead ? () => setNewLeadOpen(true) : undefined
    const openAddContact = canCreateContact ? () => setAddContactOpen(true) : undefined

    // ─── Owner picker (its list loads when first opened) ───
    const loadingOwners = useRef(false)
    const loadOwners = useCallback(async () => {
        if (loadingOwners.current) return
        loadingOwners.current = true
        const { data } = await createClient().from("profiles").select("id, full_name, avatar_url").eq("is_active", true).order("full_name")
        setOwnerOptions((data ?? []).map((person) => ({
            value: person.id as string,
            label: (person.full_name as string | null) ?? "Unnamed",
            leading: <InitialsAvatar name={(person.full_name as string | null) ?? "?"} src={person.avatar_url as string | null} size="xs" className="mr-2" />,
        })))
    }, [])

    const saveCompany = useCallback(async (payload: Record<string, unknown>, done: string, failed: string) => {
        const result = await updateClientCompanyAction(company.id, payload)
        if (!result.success) {
            toast.error(result.error || failed)
            return false
        }
        toast.success(done)
        router.refresh()
        return true
    }, [company.id, router])

    // ─── Delete ────────────────────────────────────────────
    const confirmDelete = async () => {
        setDeleting(true)
        const result = await deleteClientCompaniesAction([company.id])
        setDeleting(false)
        if (!result.success) {
            toast.error(result.error || "Failed to delete company")
            return
        }
        setDeleteOpen(false)
        toast.success("Company moved to the Recycle Bin")
        router.push("/companies")
    }

    // ─── Tabs ──────────────────────────────────────────────
    const chooseTab = useCallback((next: CompanyTab) => {
        setTab(next)
        if (next === "files") setFilesSeen(true)
        // In the address, replaced rather than pushed; `null` state, as Next.js asks.
        const query = withCompanyTab(window.location.search, next)
        window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname)
        // A view read far down starts at its top: the tabs return to where
        // they pin, the page's own scroller moving, nothing else.
        const main = document.getElementById("main-content")
        const anchor = tabsAnchorRef.current
        if (!main || !anchor) return
        const pinnedAt = anchor.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
        if (main.scrollTop > pinnedAt) main.scrollTo({ top: pinnedAt })
    }, [])

    const tabs: RecordTab<CompanyTab>[] = [
        { id: "activity", label: "Activity" },
        { id: "contacts", label: "Contacts", count: contacts.length },
        { id: "leads", label: "Leads", count: leads.length },
        { id: "files", label: "Files", count: filesCount },
    ]

    // ─── The top app bar's ⋮ (below lg) ────────────────────
    const phoneMenu: ChromeMenuItem[] = [
        ...(canEdit ? [{ label: "Edit", icon: Pencil, onSelect: openEdit }] : []),
        ...(prevCompanyId ? [{ label: "Previous company", icon: ChevronLeft, href: `/companies/${prevCompanyId}` }] : []),
        ...(nextCompanyId ? [{ label: "Next company", icon: ChevronRight, href: `/companies/${nextCompanyId}` }] : []),
        ...(canDelete ? [{ label: "Delete", icon: Trash2, onSelect: () => setDeleteOpen(true), danger: true }] : []),
    ]

    // ─── About this company ────────────────────────────────
    const segmentTier = (company.custom_data?.segment_tier as string | undefined) ?? null
    const segment = (company.custom_data?.segment as string | undefined) ?? null
    const infoFields: InfoField[] = [
        {
            key: "name", empty: false, fillable: true,
            node: (
                <InlineTextField
                    table="client_companies" id={company.id} fieldPath="name" label="Name" rawValue={company.name} required
                    save={(next) => saveCompany({ name: next }, "Name updated", "Failed to update the name")}
                />
            ),
        },
        {
            key: "industry", empty: isBlank(company.industry), fillable: true,
            node: <InlineSelectField table="client_companies" id={company.id} fieldPath="industry" label="Sector" rawValue={company.industry} optionType="sector" />,
        },
        {
            key: "segment_tier", empty: isBlank(segmentTier), fillable: true,
            node: <InlineCustomSelectField table="client_companies" id={company.id} customData={company.custom_data} customKey="segment_tier" label="Segment tier" optionType="custom_companies__segment_tier" alsoClearCustomKeys={["segment"]} alsoClearColumns={["line_industry"]} />,
        },
        {
            key: "segment", empty: isBlank(segment), fillable: true,
            node: <InlineCustomSelectField table="client_companies" id={company.id} customData={company.custom_data} customKey="segment" label="Segment" optionType="custom_companies__segment" parentValue={segmentTier} alsoClearColumns={["line_industry"]} />,
        },
        {
            key: "line_industry", empty: isBlank(company.line_industry), fillable: true,
            node: <InlineSelectField table="client_companies" id={company.id} fieldPath="line_industry" label="Line industry" rawValue={company.line_industry} optionType="line_industry" parentValue={segment} />,
        },
        {
            key: "phone", empty: isBlank(company.phone), fillable: true,
            node: <InlineTextField table="client_companies" id={company.id} fieldPath="phone" label="Phone" rawValue={company.phone} displayValue={company.phone ? formatPhoneDisplay(company.phone) : null} inputType="phone" href={tel} />,
        },
        {
            key: "website", empty: isBlank(company.website), fillable: true,
            node: <InlineTextField table="client_companies" id={company.id} fieldPath="website" label="Website" rawValue={company.website} displayValue={websiteLabel(company.website)} inputType="url" href={website} external />,
        },
        {
            key: "area", empty: isBlank(company.area), fillable: true,
            node: <InlineSelectField table="client_companies" id={company.id} fieldPath="area" label="Area" rawValue={company.area} optionType="area" />,
        },
        {
            // Street, city, postal code and country are one form's work.
            key: "address", empty: !address, fillable: true,
            node: <FieldRow label="Address" empty={!address} onEdit={canEdit ? openEdit : undefined}>{address ?? "—"}</FieldRow>,
        },
        {
            key: "owner", empty: !owner, fillable: true,
            node: (
                <InlineChoiceField
                    label="Owner" canEdit={canEdit}
                    value={owner?.id ?? company.owner_id ?? null}
                    display={owner ? <PersonLine name={owner.full_name} src={owner.avatar_url} /> : "No owner"}
                    empty={!owner}
                    options={ownerOptions} onOpen={loadOwners} clearLabel="No owner"
                    onSave={(next) => saveCompany({ owner_id: next }, "Owner updated", "Failed to update the owner")}
                />
            ),
        },
        {
            // The tenant's unit, which nobody changes here; named only to
            // someone who sees more than one.
            key: "business_unit", empty: !unitShown, fillable: false,
            node: <FieldRow label="Business unit">{unitName}</FieldRow>,
        },
        {
            key: "created", empty: !company.created_at, fillable: false,
            node: <FieldRow label="Created"><span suppressHydrationWarning>{formatCalendarDay(company.created_at)}</span></FieldRow>,
        },
    ]
    // The facts show (and edit) these; About keeps them only while they are
    // empty, to be filled in.
    const { filled, empty } = splitAboutFields(infoFields, ["phone", "website", "owner", "business_unit"])

    // ─── Shared pieces ─────────────────────────────────────
    // The facts, edited in place as About's rows are: `fact`, in the shell
    // each size draws (RecordFact on a desk, KeyFact on a phone).
    const ownerFact = (
        <InlineChoiceField
            layout="fact" label="Owner" canEdit={canEdit}
            value={owner?.id ?? company.owner_id ?? null}
            display={owner ? <PersonLine name={owner.full_name} src={owner.avatar_url} /> : <FactNone>No owner</FactNone>}
            empty={!owner}
            options={ownerOptions} onOpen={loadOwners} clearLabel="No owner"
            onSave={(next) => saveCompany({ owner_id: next }, "Owner updated", "Failed to update the owner")}
        />
    )
    const phoneFact = (
        <InlineTextField
            layout="fact" table="client_companies" id={company.id} fieldPath="phone" label="Phone" rawValue={company.phone}
            displayValue={company.phone ? formatPhoneDisplay(company.phone) : null} inputType="phone" href={tel}
            emptyText={<FactNone>No phone</FactNone>}
        />
    )
    const websiteFact = (
        <InlineTextField
            layout="fact" table="client_companies" id={company.id} fieldPath="website" label="Website" rawValue={company.website}
            displayValue={websiteLabel(company.website)} inputType="url" href={website} external
            emptyText={<FactNone>No website</FactNone>}
        />
    )
    const lastActivityFact = lastActivity ? <span suppressHydrationWarning>{lastActivity}</span> : <FactNone>No activity yet</FactNone>
    const lastModifiedLine = (
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Last modified {formatDayTime(lastModified || company.created_at) ?? "—"} by {lastModifiedBy || "System"}
        </p>
    )
    const groupItems = [
        ...(parent ? [{ key: `parent:${parent.id}`, href: `/companies/${parent.id}`, name: parent.name, detail: joinGroupLine("Parent company", companyCardLine(parent)), avatar: <InitialsAvatar name={parent.name} size="lg" shape="square" /> }] : []),
        ...subsidiaries.slice(0, 5).map((child) => ({
            key: `child:${child.id}`, href: `/companies/${child.id}`, name: child.name,
            detail: joinGroupLine("Subsidiary", companyCardLine(child)),
            avatar: <InitialsAvatar name={child.name} size="lg" shape="square" />,
        })),
    ]

    return (
        <div data-fluid-page className={cn("min-h-full bg-background", RECORD_TYPE)}>
            {/* Below `lg` the top app bar says what the page is and holds its
                actions; the desk's header is not drawn there. */}
            <PageChrome title="Company" backHref="/companies" menu={phoneMenu} />

            {/* ═══ DESK HEADER (lg+) ═══════════════════════════════ */}
            <RecordHeader
                backHref="/companies"
                backLabel="Companies"
                avatar={<InitialsAvatar name={company.name} size="header" shape="square" />}
                name={company.name}
                nameAdornment={company.needs_enrichment && <NeedsDetailsMark />}
                supporting={supporting || undefined}
                actions={
                    <>
                        <RecordStepper prevHref={prevCompanyId && `/companies/${prevCompanyId}`} nextHref={nextCompanyId && `/companies/${nextCompanyId}`} prevLabel="Previous company" nextLabel="Next company" />
                        <HeaderLinkButton href={tel} label="Call" missing="This company has no phone number" />
                        {canEdit && <Button variant="outline" onClick={openEdit} className={OUTLINED_BUTTON}>Edit</Button>}
                        {openNewLead && <Button onClick={openNewLead} className={FILLED_BUTTON}>New lead</Button>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="More actions" className={MORE_BUTTON}>
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <PermissionMenuItem resource="companies" action="delete" onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="h-4 w-4" /> Delete
                                </PermissionMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
                facts={
                    <>
                        <RecordFact label="Owner">{ownerFact}</RecordFact>
                        <RecordFact label="Phone">{phoneFact}</RecordFact>
                        <RecordFact label="Website">{websiteFact}</RecordFact>
                        <RecordFact label="Last activity">{lastActivityFact}</RecordFact>
                        {unitShown && <RecordFact label="Business unit">{unitName}</RecordFact>}
                    </>
                }
            />

            {/* ═══ PHONE HEADER (below lg) ════════════════════════ */}
            <RecordHero
                avatar={<InitialsAvatar name={company.name} size="hero" shape="square" />}
                name={company.name}
                nameAdornment={company.needs_enrichment && <NeedsDetailsMark />}
                lines={supporting ? <p className="text-sm text-muted-foreground">{supporting}</p> : undefined}
                actions={
                    <>
                        <QuickAction icon={Phone} label="Call" name={company.phone ? `Call ${formatPhoneDisplay(company.phone)}` : undefined} href={tel} missing="No phone number" />
                        <QuickAction icon={Globe} label="Website" href={website} external missing="No website" />
                        <QuickAction icon={FileText} label="Note" onClick={() => setComposerOpen(true)} />
                    </>
                }
            />

            {/* ═══ TABS ═══════════════════════════════════════════ */}
            <div ref={tabsAnchorRef} aria-hidden="true" />
            <RecordTabs tabs={tabs} value={tab} onChange={chooseTab} label="Company views" idPrefix="company" />

            {/* ═══ ACTIVITY: the composer, Upcoming and History, the record beside them ═══ */}
            <RecordPanel idPrefix="company" id="activity" active={tab === "activity"} className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
                {/* On a phone both columns dissolve into one, reordered. */}
                <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-5">
                    <KeyFactsCard className="order-1 lg:hidden">
                        <KeyFact label="Owner">{ownerFact}</KeyFact>
                        <KeyFact label="Phone">{phoneFact}</KeyFact>
                        <KeyFact label="Website">{websiteFact}</KeyFact>
                        <KeyFact label="Last activity">{lastActivityFact}</KeyFact>
                        {unitShown && <KeyFact label="Business unit">{unitName}</KeyFact>}
                    </KeyFactsCard>
                    <ActivityComposer env={composerEnv} onSubmit={log} className="hidden lg:block" />
                    <AddNoteRow onOpen={() => setComposerOpen(true)} className="order-2 lg:hidden" />
                    <div className="order-3 flex flex-col gap-3 lg:order-none lg:gap-5">
                        <RecordActivityFeed activities={activities} notes={notes} people={people} env={composerEnv} actions={activityActions} />
                    </div>
                </div>
                <div className="contents lg:flex lg:w-[320px] xl:w-[380px] lg:shrink-0 lg:flex-col lg:gap-5">
                    <div className="order-5 lg:order-none">
                        <AboutCard title="About this company" onEdit={canEdit ? openEdit : undefined} filled={filled} empty={empty} idPrefix="company" hint={canEdit} />
                    </div>
                    <div className="hidden lg:block">
                        <RelatedListCard
                            title="Contacts"
                            headingId="company-contacts-heading"
                            action={openAddContact && <CardAction onClick={openAddContact} aria-label="Add contact"><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add</CardAction>}
                            items={contacts.slice(0, 5).map((person) => ({
                                key: person.id,
                                href: `/contacts/${person.id}`,
                                name: nameWithSalutation(person.salutation, person.full_name),
                                detail: person.job_title,
                                avatar: <InitialsAvatar name={person.full_name} size="md" />,
                            }))}
                            emptyText="No contacts yet."
                            footer={contacts.length > 5 ? <CardAction onClick={() => chooseTab("contacts")}>View all {contacts.length}</CardAction> : undefined}
                        />
                    </div>
                    <RecordLeadsCard leads={leads} onNew={openNewLead} onViewAll={() => chooseTab("leads")} className="hidden lg:block" />
                    {groupTitle && (
                        <div className="order-4 lg:order-none">
                            <RelatedListCard
                                title={groupTitle}
                                headingId="company-group-heading"
                                items={groupItems}
                                footer={subsidiaries.length > 5 ? <p className="text-[13px] text-muted-foreground">and {subsidiaries.length - 5} more</p> : undefined}
                            />
                        </div>
                    )}
                    <div className="order-6 px-1 lg:order-none">{lastModifiedLine}</div>
                </div>
            </RecordPanel>

            {/* ═══ CONTACTS ═══════════════════════════════════════ */}
            <RecordPanel idPrefix="company" id="contacts" active={tab === "contacts"}>
                <CompanyContactsTable contacts={contacts} onAdd={openAddContact} />
            </RecordPanel>

            {/* ═══ LEADS ══════════════════════════════════════════ */}
            <RecordPanel idPrefix="company" id="leads" active={tab === "leads"}>
                <RecordLeadsTable leads={leads} onNew={openNewLead} emptyText="No leads yet. A lead for this company shows here." />
            </RecordPanel>

            {/* ═══ FILES ══════════════════════════════════════════ */}
            <RecordPanel idPrefix="company" id="files" active={tab === "files"}>
                {filesSeen && <RecordFiles kind="company" recordId={company.id} onCountChange={setFilesCount} />}
            </RecordPanel>

            {/* ═══ SHEETS AND DIALOGS ═════════════════════════════ */}
            <ComposerSheet open={composerOpen} onOpenChange={setComposerOpen} env={composerEnv} onSubmit={log} />
            {canCreateLead && (
                <NewLeadSheet open={newLeadOpen} onOpenChange={setNewLeadOpen} clientCompanyId={company.id} />
            )}
            <AddCompanyModal
                open={editOpen}
                onOpenChange={setEditOpen}
                initialData={company as ClientCompany}
                onCreated={() => router.refresh()}
            />
            {canCreateContact && (
                <AddContactModal
                    isOpen={addContactOpen}
                    onOpenChange={setAddContactOpen}
                    preselectedCompanyId={company.id}
                    onSuccess={() => router.refresh()}
                />
            )}
            <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move <strong className="text-foreground">{company.name}</strong> to the Recycle Bin. An admin can restore it later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(event) => { event.preventDefault(); confirmDelete() }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Move to Recycle Bin
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
//  PARTS
// ═══════════════════════════════════════════════════════════════

/** "Parent company · Banking · Jakarta": the relation first, then what the company is. */
function joinGroupLine(relation: string, line: string): string {
    return line ? `${relation} · ${line}` : relation
}
