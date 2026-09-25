"use client"

import Link from "next/link"
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageChrome, type ChromeMenuItem } from "@/components/layout/page-chrome"
import { createClient } from "@/utils/supabase/client"
import { deleteContactsAction, updateContactAction } from "@/app/actions/contact-actions"
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
    FieldRow, InlineChoiceField, InlineSelectField, InlineTextField, type ChoiceOption,
} from "@/components/shared/inline-edit-field"
import {
    AboutCard, AddNoteRow, FactLink, FactNone, FILLED_BUTTON, HeaderLinkButton, KeyFact, KeyFactsCard, MORE_BUTTON,
    OUTLINED_BUTTON, PersonLine, QuickAction, RecordFact, RecordHeader, RecordHero, RecordLeadsCard, RecordPanel,
    RecordStepper, RecordTabs, RECORD_TYPE, RelatedCompanyCard, type RecordLead, type RecordTab,
} from "@/components/shared/record-page"
import { ActivityComposer, ComposerSheet, type ComposerEnv } from "@/components/shared/record-composer"
import { RecordActivityFeed } from "@/components/shared/record-activity-feed"
import { RecordFiles } from "@/components/shared/record-files"
import { RecordLeadsTable } from "@/components/shared/record-leads-table"
import { NewLeadSheet } from "@/features/leads/components/new-lead-sheet"
import { companyCardLine } from "@/features/companies/lib/company-record"
import { contactActivityTarget, useRecordActivity, useRecordAssignees } from "@/hooks/use-record-activity"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { cn } from "@/lib/utils"
import {
    buildFeed, externalHref, firstName, formatCalendarDay, formatDayTime, isBlank, lastActivityLabel, mailtoHref,
    splitEmptyFields, telHref, whatsAppHref, type ActivityRow, type NoteRow, type PeopleById,
} from "@/lib/record-page"
import type { RecordViewer } from "@/lib/record-activity"
import {
    ChevronLeft, ChevronRight, FileText, Loader2, Mail, MessageCircle, MoreVertical, Pencil, Phone, Trash2,
} from "@/components/icons"
import {
    discSummary, formatCustomValue, nameWithSalutation, readDisc, secondaryValues, showBusinessUnit, socialLinks,
    withContactTab, type ContactTab, type DiscReading, type SocialLink,
} from "../lib/contact-record"
import { AddContactModal } from "./add-contact-modal"

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface ContactPerson {
    id: string
    full_name: string
    email?: string | null
    avatar_url?: string | null
}

interface ContactData {
    id: string
    salutation: string | null
    full_name: string
    email: string | null
    phone: string | null
    job_title: string | null
    contact_source: string | null
    secondary_email: string | null
    secondary_phone: string | null
    secondary_emails: string[] | null
    secondary_phones: string[] | null
    linkedin_url: string | null
    notes: string | null
    date_of_birth: string | null
    address: string | null
    social_urls: Partial<SocialLink>[] | null
    /** Free-form per-tenant fields; `disc` is the reading Sales Activity sends (see readDisc). */
    custom_fields?: Record<string, unknown> | null
    /** The values of the fields an admin added to the form (form_schemas). */
    custom_data?: Record<string, unknown> | null
    owner_id?: string | null
    company_id?: string | null
    client_company?: { id: string; name: string; industry?: string | null; line_industry?: string | null; city?: string | null; area?: string | null } | null
    owner?: ContactPerson | null
    needs_enrichment?: boolean
    created_at?: string
    updated_at?: string | null
}

/** A field an admin added to the contact form (Settings → Layout). */
export interface ContactCustomField {
    field_key: string
    field_name: string
    field_type: string
}

interface ContactDetailPageProps {
    contact: ContactData
    leads: RecordLead[]
    /** The contact's timeline, newest first. */
    activities: ActivityRow[]
    /** The contact's notes, newest first. */
    notes: NoteRow[]
    /** The people the timeline names beyond its authors: assignees, who ticked a follow-up done. */
    people: PeopleById
    /** Who is looking: their id, name and whether they are an admin (what they may edit and tick). */
    viewer: RecordViewer
    fileCount: number | null
    lastModified?: string
    lastModifiedBy?: string
    nextContactId?: string
    prevContactId?: string
    /** The tenant's business unit the contact belongs to (`companies`, never the client company). */
    businessUnit?: { id: string; name: string } | null
    customFields?: ContactCustomField[]
    initialTab?: ContactTab
}

/** One property in About this contact, with whether it is empty and whether a person fills it in. */
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
 * A contact's record page, the approved design (Figma "Contact detail —
 * Desktop 1440" and "— Phone 390"; DESIGN.md, "Record pages"). One scroll
 * in the shell's `<main>`:
 *
 *   desk (lg+)  the header: back (←, "Back to Contacts"), avatar, name,
 *               job title · company, ‹ › Call Email Edit New lead ⋮; the
 *               facts: Owner, Phone, Email, Last activity
 *               tabs pinned to the top: Activity · Leads n · Files n
 *               Activity: the composer, Upcoming (open follow-ups) and
 *               History; beside them (380px) About this contact, Company,
 *               Leads. Leads and Files take the whole width
 *   phone       the top app bar ("Contact", back, ⋮ Edit / Email / ‹ › / Delete)
 *               the header centred: avatar, name, job title, company, then
 *               Call · WhatsApp · Email · Note
 *               tabs pinned under the top app bar; Activity: Key facts,
 *               Add a note… (the composer, in a bottom sheet), Upcoming,
 *               History, then Company and About this contact
 */
export function ContactDetailPage({
    contact, leads, activities, notes, people, viewer, fileCount, lastModified, lastModifiedBy, nextContactId, prevContactId,
    businessUnit = null, customFields = [], initialTab = "activity",
}: ContactDetailPageProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const { isHoldingView, companies } = useCompany()
    const canEdit = can("contacts", "update")
    const canDelete = can("contacts", "delete")
    const canCreateLead = can("leads", "create")

    const [tab, setTab] = useState<ContactTab>(initialTab)
    // The Files tab loads its list when first opened, and is kept after.
    const [filesSeen, setFilesSeen] = useState(initialTab === "files")
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [composerOpen, setComposerOpen] = useState(false)
    const [newLeadOpen, setNewLeadOpen] = useState(false)
    const [filesCount, setFilesCount] = useState<number | null>(fileCount)
    const [ownerOptions, setOwnerOptions] = useState<ChoiceOption[] | null>(null)
    const [companyOptions, setCompanyOptions] = useState<ChoiceOption[] | null>(null)
    const tabsAnchorRef = useRef<HTMLDivElement>(null)

    // ─── Facts ─────────────────────────────────────────────
    const nameDisplay = nameWithSalutation(contact.salutation, contact.full_name)
    const owner = contact.owner ?? null
    const company = contact.client_company?.id ? contact.client_company : null
    const unitName = businessUnit?.name ?? companies.find((unit) => unit.id === contact.company_id)?.name ?? null
    const unitShown = showBusinessUnit({ unitName, isHoldingView, unitCount: companies.length })
    const mailto = mailtoHref(contact.email)
    const tel = telHref(contact.phone)
    const whatsApp = whatsAppHref(contact.phone)
    const disc = readDisc(contact.custom_fields)
    const feed = useMemo(() => buildFeed(activities, notes, people), [activities, notes, people])
    const lastActivity = lastActivityLabel(feed)
    const target = useMemo(() => contactActivityTarget(contact.id), [contact.id])
    const { log, ...activityActions } = useRecordActivity(target)
    const { assignees, loadAssignees } = useRecordAssignees(target)
    const composerEnv: ComposerEnv = {
        subject: firstName(contact.full_name),
        viewer: { id: viewer.id, isAdmin: viewer.isAdmin },
        viewerName: viewer.name,
        assignees,
        loadAssignees,
    }

    const openEdit = () => setEditOpen(true)
    const openNewLead = canCreateLead ? () => setNewLeadOpen(true) : undefined

    // ─── Owner and company pickers (their lists load when first opened) ───
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
    const loadingCompanies = useRef(false)
    const loadCompanies = useCallback(async () => {
        if (loadingCompanies.current) return
        loadingCompanies.current = true
        const { data } = await createClient().from("client_companies").select("id, name").is("deleted_at", null).order("name")
        setCompanyOptions((data ?? []).map((row) => ({ value: row.id as string, label: row.name as string })))
    }, [])

    const saveContact = useCallback(async (payload: Record<string, unknown>, done: string, failed: string) => {
        const result = await updateContactAction(contact.id, payload)
        if (!result.success) {
            toast.error(result.error || failed)
            return false
        }
        toast.success(done)
        router.refresh()
        return true
    }, [contact.id, router])

    // ─── Delete ────────────────────────────────────────────
    const confirmDelete = async () => {
        setDeleting(true)
        const result = await deleteContactsAction([contact.id])
        setDeleting(false)
        if (!result.success) {
            toast.error(result.error || "Failed to delete contact")
            return
        }
        setDeleteOpen(false)
        toast.success("Contact moved to the Recycle Bin")
        router.push("/contacts")
    }

    // ─── Tabs ──────────────────────────────────────────────
    const chooseTab = useCallback((next: ContactTab) => {
        setTab(next)
        if (next === "files") setFilesSeen(true)
        // In the address, replaced rather than pushed, so a reload and Back
        // from a lead come back to it; `null` state, as Next.js asks.
        const query = withContactTab(window.location.search, next)
        window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname)
        // A view read far down starts at its top: the tabs return to where
        // they pin, the page's own scroller moving, nothing else.
        const main = document.getElementById("main-content")
        const anchor = tabsAnchorRef.current
        if (!main || !anchor) return
        const pinnedAt = anchor.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
        if (main.scrollTop > pinnedAt) main.scrollTo({ top: pinnedAt })
    }, [])

    const tabs: RecordTab<ContactTab>[] = [
        { id: "activity", label: "Activity" },
        { id: "leads", label: "Leads", count: leads.length },
        { id: "files", label: "Files", count: filesCount },
    ]

    // ─── The top app bar's ⋮ (below lg) ────────────────────
    // `PageChrome` compares the items by label, so a new array on each
    // render announces nothing new, and each handler reaches this render.
    // The desk's ‹ › live here on a phone, so no way through the contacts is lost.
    const phoneMenu: ChromeMenuItem[] = [
        ...(canEdit ? [{ label: "Edit", icon: Pencil, onSelect: openEdit }] : []),
        ...(mailto ? [{ label: "Email", icon: Mail, onSelect: () => { window.location.href = mailto } }] : []),
        ...(prevContactId ? [{ label: "Previous contact", icon: ChevronLeft, href: `/contacts/${prevContactId}` }] : []),
        ...(nextContactId ? [{ label: "Next contact", icon: ChevronRight, href: `/contacts/${nextContactId}` }] : []),
        ...(canDelete ? [{ label: "Delete", icon: Trash2, onSelect: () => setDeleteOpen(true), danger: true }] : []),
    ]

    // ─── About this contact ────────────────────────────────
    const editForm = canEdit ? openEdit : undefined
    const secondaryEmails = secondaryValues(contact.secondary_email, contact.secondary_emails)
    const secondaryPhones = secondaryValues(contact.secondary_phone, contact.secondary_phones)
    const socials = socialLinks(contact.linkedin_url, contact.social_urls)
    const ownerDisplay = owner ? <PersonLine name={owner.full_name} src={owner.avatar_url} /> : "No owner"

    const infoFields: InfoField[] = [
        {
            // The salutation reads with the name, as it is spoken; it is
            // changed in the Edit form, the name here.
            key: "full_name", empty: false, fillable: true,
            node: <InlineTextField table="contacts" id={contact.id} fieldPath="full_name" label="Full name" rawValue={contact.full_name} displayValue={nameDisplay} required />,
        },
        {
            key: "job_title", empty: isBlank(contact.job_title), fillable: true,
            node: <InlineTextField table="contacts" id={contact.id} fieldPath="job_title" label="Job title" rawValue={contact.job_title} />,
        },
        {
            key: "email", empty: isBlank(contact.email), fillable: true,
            node: <InlineTextField table="contacts" id={contact.id} fieldPath="email" label="Email" rawValue={contact.email} displayValue={contact.email ? <EmailText email={contact.email} /> : null} href={mailto} />,
        },
        {
            key: "phone", empty: isBlank(contact.phone), fillable: true,
            node: <InlineTextField table="contacts" id={contact.id} fieldPath="phone" label="Phone" rawValue={contact.phone} displayValue={contact.phone ? formatPhoneDisplay(contact.phone) : null} inputType="phone" href={tel} />,
        },
        {
            key: "address", empty: isBlank(contact.address), fillable: true,
            node: <InlineTextField table="contacts" id={contact.id} fieldPath="address" label="Address" rawValue={contact.address} />,
        },
        {
            key: "contact_source", empty: isBlank(contact.contact_source), fillable: true,
            node: <InlineSelectField table="contacts" id={contact.id} fieldPath="contact_source" label="Contact source" rawValue={contact.contact_source} optionType="contact_source" />,
        },
        {
            key: "disc", empty: !disc, fillable: false,
            node: disc && <FieldRow label="Communication style"><DiscValue disc={disc} /></FieldRow>,
        },
        {
            key: "client_company", empty: !company, fillable: true,
            node: (
                <InlineChoiceField
                    label="Company" canEdit={canEdit}
                    value={company?.id ?? null} display={company?.name ?? "—"} empty={!company}
                    options={companyOptions} onOpen={loadCompanies} clearLabel="No company"
                    onSave={(next) => saveContact({ client_company_id: next }, "Company updated", "Failed to update company")}
                />
            ),
        },
        {
            key: "owner", empty: !owner, fillable: true,
            node: (
                <InlineChoiceField
                    label="Owner" canEdit={canEdit}
                    value={owner?.id ?? contact.owner_id ?? null} display={ownerDisplay} empty={!owner}
                    options={ownerOptions} onOpen={loadOwners} clearLabel="No owner"
                    onSave={(next) => saveContact({ owner_id: next }, "Owner updated", "Failed to update the owner")}
                />
            ),
        },
        {
            key: "secondary_emails", empty: secondaryEmails.length === 0, fillable: true,
            node: (
                <FieldRow label="Secondary emails" empty={secondaryEmails.length === 0} onEdit={editForm} links>
                    {secondaryEmails.length === 0 ? "—" : secondaryEmails.map((email) => (
                        <a key={email} href={`mailto:${email}`} className="block break-words font-medium text-primary hover:underline"><EmailText email={email} /></a>
                    ))}
                </FieldRow>
            ),
        },
        {
            key: "secondary_phones", empty: secondaryPhones.length === 0, fillable: true,
            node: (
                <FieldRow label="Secondary phones" empty={secondaryPhones.length === 0} onEdit={editForm} links>
                    {secondaryPhones.length === 0 ? "—" : secondaryPhones.map((phone) => (
                        // tel: takes the stored number, not the spaced display form.
                        <a key={phone} href={telHref(phone) ?? undefined} className="block font-medium text-primary hover:underline">{formatPhoneDisplay(phone)}</a>
                    ))}
                </FieldRow>
            ),
        },
        {
            key: "social", empty: socials.length === 0, fillable: true,
            node: (
                <FieldRow label="Social links" empty={socials.length === 0} onEdit={editForm} links>
                    {socials.length === 0 ? "—" : socials.map((link) => (
                        <a key={link.url} href={externalHref(link.url)} target="_blank" rel="noopener noreferrer" className="block font-medium text-primary wrap-anywhere hover:underline">
                            <span className="font-normal text-muted-foreground">{link.platform}:</span> {link.url}
                        </a>
                    ))}
                </FieldRow>
            ),
        },
        {
            key: "date_of_birth", empty: isBlank(contact.date_of_birth), fillable: true,
            node: <InlineTextField table="contacts" id={contact.id} fieldPath="date_of_birth" label="Date of birth" rawValue={contact.date_of_birth} displayValue={formatCalendarDay(contact.date_of_birth)} inputType="date" />,
        },
        // A salutation reads in Full name; the row is offered only while there is none.
        ...(isBlank(contact.salutation) ? [{
            key: "salutation", empty: true, fillable: true,
            node: <FieldRow label="Salutation" empty onEdit={editForm}>—</FieldRow>,
        }] : []),
        {
            // The tenant's unit, which nobody changes here; named only to
            // someone who sees more than one.
            key: "business_unit", empty: !unitShown, fillable: false,
            node: <FieldRow label="Business unit">{unitName}</FieldRow>,
        },
        ...customFields.map((field): InfoField => {
            const value = formatCustomValue(contact.custom_data?.[field.field_key], field.field_type)
            return {
                key: `custom:${field.field_key}`, empty: value === null, fillable: true,
                node: <FieldRow label={field.field_name} empty={value === null} onEdit={editForm}>{value ?? "—"}</FieldRow>,
            }
        }),
        {
            // The free-text notes from before Notes existed: shown while
            // they hold something, never offered as a field to fill.
            key: "notes", empty: isBlank(contact.notes), fillable: false,
            node: <FieldRow label="Legacy notes" onEdit={editForm}><span className="whitespace-pre-wrap">{contact.notes}</span></FieldRow>,
        },
    ]
    const { filled, empty } = splitEmptyFields(infoFields)

    // ─── Shared pieces ─────────────────────────────────────
    const ownerFact = owner ? <PersonLine name={owner.full_name} src={owner.avatar_url} /> : <FactNone>No owner</FactNone>
    const phoneFact = tel && contact.phone ? <FactLink href={tel}>{formatPhoneDisplay(contact.phone)}</FactLink> : contact.phone ? contact.phone : <FactNone>No phone</FactNone>
    const emailFact = mailto && contact.email ? <FactLink href={mailto}>{contact.email}</FactLink> : <FactNone>No email</FactNone>
    const lastActivityFact = lastActivity ? <span suppressHydrationWarning>{lastActivity}</span> : <FactNone>No activity yet</FactNone>
    const lastModifiedLine = (
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            Last modified {formatDayTime(lastModified || contact.created_at) ?? "—"} by {lastModifiedBy || "System"}
        </p>
    )

    return (
        <div data-fluid-page className={cn("min-h-full bg-background", RECORD_TYPE)}>
            {/* Below `lg` the top app bar says what the page is and holds its
                actions; the desk's header is not drawn there. */}
            <PageChrome title="Contact" backHref="/contacts" menu={phoneMenu} />

            {/* ═══ DESK HEADER (lg+) ═══════════════════════════════ */}
            <RecordHeader
                backHref="/contacts"
                backLabel="Contacts"
                avatar={<InitialsAvatar name={contact.full_name} size="header" />}
                name={contact.full_name}
                nameAdornment={contact.needs_enrichment && <NeedsDetailsMark />}
                supporting={(contact.job_title || company) && (
                    <>
                        {contact.job_title}
                        {contact.job_title && company && " · "}
                        {company && <Link href={`/companies/${company.id}`} className="font-medium text-primary hover:underline">{company.name}</Link>}
                    </>
                )}
                actions={
                    <>
                        <RecordStepper prevHref={prevContactId && `/contacts/${prevContactId}`} nextHref={nextContactId && `/contacts/${nextContactId}`} prevLabel="Previous contact" nextLabel="Next contact" />
                        <HeaderLinkButton href={tel} label="Call" missing="This contact has no phone number" />
                        <HeaderLinkButton href={mailto} label="Email" missing="This contact has no email address" />
                        {canEdit && <Button variant="outline" onClick={openEdit} className={OUTLINED_BUTTON}>Edit</Button>}
                        {openNewLead && <Button onClick={openNewLead} className={FILLED_BUTTON}>New lead</Button>}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="More actions" className={MORE_BUTTON}>
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <PermissionMenuItem resource="contacts" action="delete" onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
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
                        <RecordFact label="Email">{emailFact}</RecordFact>
                        <RecordFact label="Last activity">{lastActivityFact}</RecordFact>
                        {unitShown && <RecordFact label="Business unit">{unitName}</RecordFact>}
                    </>
                }
            />

            {/* ═══ PHONE HEADER (below lg) ════════════════════════ */}
            <RecordHero
                avatar={<InitialsAvatar name={contact.full_name} size="hero" />}
                name={contact.full_name}
                nameAdornment={contact.needs_enrichment && <NeedsDetailsMark />}
                lines={
                    <>
                        {contact.job_title && <p className="text-sm text-muted-foreground">{contact.job_title}</p>}
                        {company && <Link href={`/companies/${company.id}`} className="text-sm font-medium text-primary">{company.name}</Link>}
                    </>
                }
                actions={
                    <>
                        <QuickAction icon={Phone} label="Call" href={tel} missing="No phone number" />
                        <QuickAction icon={MessageCircle} label="WhatsApp" href={whatsApp} external missing="No phone number" />
                        <QuickAction icon={Mail} label="Email" href={mailto} missing="No email address" />
                        <QuickAction icon={FileText} label="Note" onClick={() => setComposerOpen(true)} />
                    </>
                }
            />

            {/* ═══ TABS ═══════════════════════════════════════════ */}
            <div ref={tabsAnchorRef} aria-hidden="true" />
            <RecordTabs tabs={tabs} value={tab} onChange={chooseTab} label="Contact views" idPrefix="contact" />

            {/* ═══ ACTIVITY: the composer, Upcoming and History, the record beside them ═══ */}
            <RecordPanel idPrefix="contact" id="activity" active={tab === "activity"} className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
                {/* On a phone both columns dissolve into one, reordered. */}
                <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-5">
                    <KeyFactsCard className="order-1 lg:hidden">
                        <KeyFact label="Owner">{ownerFact}</KeyFact>
                        <KeyFact label="Phone">{phoneFact}</KeyFact>
                        <KeyFact label="Email">{emailFact}</KeyFact>
                        <KeyFact label="Last activity">{lastActivityFact}</KeyFact>
                    </KeyFactsCard>
                    <ActivityComposer env={composerEnv} onSubmit={log} className="hidden lg:block" />
                    <AddNoteRow onOpen={() => setComposerOpen(true)} className="order-2 lg:hidden" />
                    <div className="order-3 flex flex-col gap-3 lg:order-none lg:gap-5">
                        <RecordActivityFeed activities={activities} notes={notes} people={people} env={composerEnv} actions={activityActions} />
                    </div>
                </div>
                <div className="contents lg:flex lg:w-[320px] xl:w-[380px] lg:shrink-0 lg:flex-col lg:gap-5">
                    <div className="order-5 lg:order-none">
                        <AboutCard title="About this contact" onEdit={editForm} filled={filled} empty={empty} idPrefix="contact" />
                    </div>
                    {company && (
                        <div className="order-4 lg:order-none">
                            <RelatedCompanyCard company={{ id: company.id, name: company.name, line: companyCardLine(company) }} />
                        </div>
                    )}
                    <RecordLeadsCard leads={leads} onNew={openNewLead} onViewAll={() => chooseTab("leads")} className="hidden lg:block" />
                    <div className="order-6 px-1 lg:order-none">{lastModifiedLine}</div>
                </div>
            </RecordPanel>

            {/* ═══ LEADS ══════════════════════════════════════════ */}
            <RecordPanel idPrefix="contact" id="leads" active={tab === "leads"}>
                <RecordLeadsTable leads={leads} onNew={openNewLead} emptyText="No leads yet. A lead that names this contact as its contact person shows here." />
            </RecordPanel>

            {/* ═══ FILES ══════════════════════════════════════════ */}
            <RecordPanel idPrefix="contact" id="files" active={tab === "files"}>
                {filesSeen && <RecordFiles kind="contact" recordId={contact.id} onCountChange={setFilesCount} />}
            </RecordPanel>

            {/* ═══ SHEETS AND DIALOGS ═════════════════════════════ */}
            <ComposerSheet open={composerOpen} onOpenChange={setComposerOpen} env={composerEnv} onSubmit={log} />
            {canCreateLead && (
                <NewLeadSheet
                    open={newLeadOpen}
                    onOpenChange={setNewLeadOpen}
                    clientCompanyId={company?.id ?? null}
                    // The contact picker lists a company's people, so the
                    // contact is filled in only with its company.
                    contactId={company ? contact.id : null}
                />
            )}
            <AddContactModal
                isOpen={editOpen}
                onOpenChange={setEditOpen}
                initialData={contact}
                onSuccess={() => router.refresh()}
            />
            <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move <strong className="text-foreground">{contact.full_name}</strong> to the Recycle Bin. An admin can restore it later.
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

/** An address that, when it must wrap, wraps after the "@" rather than inside the domain. */
function EmailText({ email }: { email: string }) {
    const at = email.indexOf("@")
    if (at <= 0) return <>{email}</>
    return <>{email.slice(0, at + 1)}<wbr />{email.slice(at + 1)}</>
}

/**
 * The DISC reading as a small tonal badge with its meaning beside it, the
 * rep's note under it in their own words (Indonesian) and who assessed it
 * and when; one rep's impression on one day, so it is signed and never a
 * status (DESIGN.md, "A field reading is a badge, signed").
 */
function DiscValue({ disc }: { disc: DiscReading }) {
    const { code, meaning } = discSummary(disc)
    const when = formatCalendarDay(disc.assessedAt)
    const signed = disc.assessedByName ? `Assessed by ${disc.assessedByName}${when ? ` on ${when}` : ""}` : when ? `Assessed on ${when}` : null
    return (
        <>
            {/* The badge sits in the sentence's first line (inline, on the
                text's own 20px line height), so a meaning that wraps runs on
                under it instead of dropping the whole meaning to a new line
                with a gap above it; note and signature follow 4px apart. */}
            <span className="block">
                <span className="mr-1.5 inline-block rounded-[6px] bg-primary/10 px-1.5 align-baseline text-xs font-semibold leading-5 text-primary" title={meaning}>{code}</span>
                {meaning}
            </span>
            {disc.note && <span className="mt-1 block break-words">{disc.note}</span>}
            {signed && <span className="mt-1 block text-xs leading-4 text-muted-foreground">{signed}</span>}
        </>
    )
}
