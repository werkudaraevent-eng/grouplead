"use client"

import Link from "next/link"
import { Fragment, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageChrome, type ChromeMenuItem } from "@/components/layout/page-chrome"
import { createClient } from "@/utils/supabase/client"
import { deleteContactsAction, updateContactAction } from "@/app/actions/contact-actions"
import { usePermissions } from "@/contexts/permissions-context"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
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
import { RecordTabs, SectionChips, SectionRail, type SectionLink } from "@/components/shared/record-page"
import { useSectionSpy } from "@/hooks/use-section-spy"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { cn } from "@/lib/utils"
import {
    ChevronDown, ChevronLeft, ChevronRight, Loader2, Mail, MessageCircle, MoreVertical, Pencil, Phone, Trash2,
} from "@/components/icons"
import {
    CONTACT_SECTIONS, CONTACT_TABS, contactSectionDomId, discSummary, emptyFieldsToggleLabel, externalHref,
    formatCalendarDay, formatCustomValue, formatDayTime, isBlank, mailtoHref, nameWithSalutation, readDisc,
    secondaryValues, sectionCounts, showBusinessUnit, socialLinks, splitEmptyFields, telHref, whatsAppHref,
    withContactTab, type ContactTab, type DiscReading, type SocialLink,
} from "../lib/contact-record"
import { ContactTimelineTab } from "./contact-timeline-tab"
import { AddContactModal } from "./add-contact-modal"
import { ContactFilesTab } from "./contact-files-tab"
import { ContactNotesSection } from "./contact-notes-section"
import { ContactLeadsSection, type ContactLead } from "./contact-leads-section"

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
    client_company?: { id: string; name: string } | null
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
    leads: ContactLead[]
    lastModified?: string
    lastModifiedBy?: string
    nextContactId?: string
    prevContactId?: string
    /** The tenant's business unit the contact belongs to (`companies`, never the client company). */
    businessUnit?: { id: string; name: string } | null
    customFields?: ContactCustomField[]
    initialTab?: ContactTab
}

/** One property in Contact information, with whether it is empty and whether a person fills it in. */
interface InfoField {
    key: string
    empty: boolean
    fillable: boolean
    node: ReactNode
}

const SECTION_IDS = CONTACT_SECTIONS.map((section) => contactSectionDomId(section.id))
const SECTIONS_END_ID = "contact-sections-end"

/** M3's tonal button: the secondary container, with an 8% state layer on hover. */
const TONAL_BUTTON = "border-transparent bg-[var(--tonal)] text-[var(--tonal-foreground)] shadow-none hover:bg-[color-mix(in_srgb,var(--tonal-foreground)_8%,var(--tonal))]"

// ═══════════════════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════════════════

/**
 * A contact's record page, on Zoho CRM's record page with Material 3's
 * rules (DESIGN.md, "Record pages"). One scroll in the shell's `<main>`:
 *
 *   desk (lg+)  header row, pinned: avatar, "Contacts" / name, ‹ ›, Send email, Edit, ⋮
 *               the facts under it: job title · company, owner, business unit
 *               tabs, pinned under the row: Overview | Timeline
 *               Overview: the related-list rail (Info, Notes, Leads, Files),
 *               pinned beside one column of sections, 840px at most
 *   phone       the top app bar ("Contact", back, ⋮ Edit / Send email / ‹ › / Delete)
 *               a header card: avatar, name, facts, Call · WhatsApp · Email
 *               tabs pinned under the top app bar, then the sections' chips
 *
 * Overview is the summary card (Zoho's business card), Contact information
 * (every field, label : value, edited in place, the empty ones folded),
 * Notes, Leads and Files; Timeline is the contact's activity log.
 */
export function ContactDetailPage({
    contact, leads, lastModified, lastModifiedBy, nextContactId, prevContactId,
    businessUnit = null, customFields = [], initialTab = "overview",
}: ContactDetailPageProps) {
    const router = useRouter()
    const { can } = usePermissions()
    const { isHoldingView, companies } = useCompany()
    const canEdit = can("contacts", "update")
    const canDelete = can("contacts", "delete")

    const [tab, setTab] = useState<ContactTab>(initialTab)
    // The Timeline loads its log when first opened, and is kept after.
    const [timelineSeen, setTimelineSeen] = useState(initialTab === "timeline")
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showEmpty, setShowEmpty] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [notesCount, setNotesCount] = useState<number | null>(null)
    const [filesCount, setFilesCount] = useState<number | null>(null)
    const [ownerOptions, setOwnerOptions] = useState<ChoiceOption[] | null>(null)
    const [companyOptions, setCompanyOptions] = useState<ChoiceOption[] | null>(null)

    const headerRowRef = useRef<HTMLDivElement>(null)
    const tabsRef = useRef<HTMLDivElement>(null)
    const tabsAnchorRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        createClient().auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
    }, [])

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

    const openEdit = () => setEditOpen(true)

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
        if (next === "timeline") setTimelineSeen(true)
        // In the address, replaced rather than pushed, so a reload and Back
        // from a lead come back to it; `null` state, as Next.js asks.
        const query = withContactTab(window.location.search, next)
        window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname)
        // A view read far down starts at its top: the tabs return to where
        // they pin, the page's own scroller moving, nothing else.
        const main = document.getElementById("main-content")
        const anchor = tabsAnchorRef.current
        if (!main || !anchor) return
        const pinnedAt = anchor.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - (headerRowRef.current?.offsetHeight ?? 0)
        if (main.scrollTop > pinnedAt) main.scrollTo({ top: pinnedAt })
    }, [])

    // ─── Sections: the rail, the chips, the one being read ───
    const getPinned = useCallback(() => (headerRowRef.current?.offsetHeight ?? 0) + (tabsRef.current?.offsetHeight ?? 0), [])
    const { active, jumpTo } = useSectionSpy({ ids: SECTION_IDS, endId: SECTIONS_END_ID, getPinned, enabled: tab === "overview" })
    const counts = sectionCounts({ notes: notesCount, leads: leads.length, files: filesCount })
    const sectionLinks: SectionLink[] = CONTACT_SECTIONS.map((section) => ({
        domId: contactSectionDomId(section.id),
        label: section.label,
        count: counts[section.id],
    }))

    // ─── The top app bar's ⋮ (below lg) ────────────────────
    // `PageChrome` compares the items by label, so a new array on each
    // render announces nothing new, and each handler reaches this render.
    // The desk's ‹ › live here on a phone, so no way through the contacts is lost.
    const phoneMenu: ChromeMenuItem[] = [
        ...(canEdit ? [{ label: "Edit", icon: Pencil, onSelect: openEdit }] : []),
        ...(mailto ? [{ label: "Send email", icon: Mail, onSelect: () => { window.location.href = mailto } }] : []),
        ...(prevContactId ? [{ label: "Previous contact", icon: ChevronLeft, href: `/contacts/${prevContactId}` }] : []),
        ...(nextContactId ? [{ label: "Next contact", icon: ChevronRight, href: `/contacts/${nextContactId}` }] : []),
        ...(canDelete ? [{ label: "Delete", icon: Trash2, onSelect: () => setDeleteOpen(true), danger: true }] : []),
    ]

    // ─── Contact information ───────────────────────────────
    const editForm = canEdit ? openEdit : undefined
    const secondaryEmails = secondaryValues(contact.secondary_email, contact.secondary_emails)
    const secondaryPhones = secondaryValues(contact.secondary_phone, contact.secondary_phones)
    const socials = socialLinks(contact.linkedin_url, contact.social_urls)
    const ownerDisplay = owner ? <PersonLine person={owner} /> : "No owner"

    const infoFields: InfoField[] = [
        {
            key: "full_name", empty: false, fillable: true,
            node: <InlineTextField layout="row" table="contacts" id={contact.id} fieldPath="full_name" label="Name" rawValue={contact.full_name} required />,
        },
        {
            key: "salutation", empty: isBlank(contact.salutation), fillable: true,
            node: <FieldRow label="Salutation" empty={isBlank(contact.salutation)} onEdit={editForm}>{contact.salutation || "—"}</FieldRow>,
        },
        {
            key: "client_company", empty: !company, fillable: true,
            node: (
                <InlineChoiceField
                    layout="row" label="Company" canEdit={canEdit}
                    value={company?.id ?? null} display={company?.name ?? "—"} empty={!company}
                    options={companyOptions} onOpen={loadCompanies} clearLabel="No company"
                    onSave={(next) => saveContact({ client_company_id: next }, "Company updated", "Failed to update company")}
                />
            ),
        },
        {
            key: "job_title", empty: isBlank(contact.job_title), fillable: true,
            node: <InlineTextField layout="row" table="contacts" id={contact.id} fieldPath="job_title" label="Job title" rawValue={contact.job_title} />,
        },
        {
            key: "contact_source", empty: isBlank(contact.contact_source), fillable: true,
            node: <InlineSelectField layout="row" table="contacts" id={contact.id} fieldPath="contact_source" label="Contact source" rawValue={contact.contact_source} optionType="contact_source" />,
        },
        {
            key: "disc", empty: !disc, fillable: false,
            node: disc && <FieldRow label="Communication style (DISC)"><DiscValue disc={disc} /></FieldRow>,
        },
        {
            key: "email", empty: isBlank(contact.email), fillable: true,
            node: <InlineTextField layout="row" table="contacts" id={contact.id} fieldPath="email" label="Email" rawValue={contact.email} />,
        },
        {
            key: "secondary_emails", empty: secondaryEmails.length === 0, fillable: true,
            node: (
                <FieldRow label="Secondary emails" empty={secondaryEmails.length === 0} onEdit={editForm} links>
                    {secondaryEmails.length === 0 ? "—" : secondaryEmails.map((email) => (
                        <a key={email} href={`mailto:${email}`} className="block text-primary break-words hover:underline"><EmailText email={email} /></a>
                    ))}
                </FieldRow>
            ),
        },
        {
            key: "phone", empty: isBlank(contact.phone), fillable: true,
            node: <InlineTextField layout="row" table="contacts" id={contact.id} fieldPath="phone" label="Phone" rawValue={contact.phone} displayValue={contact.phone ? formatPhoneDisplay(contact.phone) : null} inputType="phone" />,
        },
        {
            key: "secondary_phones", empty: secondaryPhones.length === 0, fillable: true,
            node: (
                <FieldRow label="Secondary phones" empty={secondaryPhones.length === 0} onEdit={editForm} links>
                    {secondaryPhones.length === 0 ? "—" : secondaryPhones.map((phone) => (
                        // tel: takes the stored number, not the spaced display form.
                        <a key={phone} href={telHref(phone) ?? undefined} className="block text-primary hover:underline">{formatPhoneDisplay(phone)}</a>
                    ))}
                </FieldRow>
            ),
        },
        {
            key: "social", empty: socials.length === 0, fillable: true,
            node: (
                <FieldRow label="Social links" empty={socials.length === 0} onEdit={editForm} links>
                    {socials.length === 0 ? "—" : socials.map((link) => (
                        <a key={link.url} href={externalHref(link.url)} target="_blank" rel="noopener noreferrer" className="block text-primary wrap-anywhere hover:underline">
                            <span className="text-muted-foreground">{link.platform}:</span> {link.url}
                        </a>
                    ))}
                </FieldRow>
            ),
        },
        {
            key: "date_of_birth", empty: isBlank(contact.date_of_birth), fillable: true,
            node: <InlineTextField layout="row" table="contacts" id={contact.id} fieldPath="date_of_birth" label="Date of birth" rawValue={contact.date_of_birth} displayValue={formatCalendarDay(contact.date_of_birth)} inputType="date" />,
        },
        {
            key: "address", empty: isBlank(contact.address), fillable: true,
            node: <InlineTextField layout="row" table="contacts" id={contact.id} fieldPath="address" label="Address" rawValue={contact.address} />,
        },
        {
            key: "owner", empty: !owner, fillable: true,
            node: (
                <InlineChoiceField
                    layout="row" label="Owner" canEdit={canEdit}
                    value={owner?.id ?? contact.owner_id ?? null} display={ownerDisplay} empty={!owner}
                    options={ownerOptions} onOpen={loadOwners} clearLabel="No owner"
                    onSave={(next) => saveContact({ owner_id: next }, "Owner updated", "Failed to update the owner")}
                />
            ),
        },
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

    return (
        <div data-fluid-page className="min-h-full bg-background pb-12">
            {/* Below `lg` the top app bar says what the page is and holds its
                actions; the desk's header row is not drawn there. */}
            <PageChrome title="Contact" backHref="/contacts" menu={phoneMenu} />

            {/* ═══ DESK HEADER (lg+) ═══════════════════════════════ */}
            <div ref={headerRowRef} className="sticky top-0 z-30 hidden min-h-14 items-center gap-3 bg-background px-8 py-1.5 lg:flex">
                <InitialsAvatar name={contact.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                    {/* The line box is the nav's own 16px, not the body's 24px, so the row stays 56dp. */}
                    <nav aria-label="Breadcrumb" className="text-xs leading-4">
                        <Link href="/contacts" className="font-medium text-muted-foreground transition-colors hover:text-primary">Contacts</Link>
                    </nav>
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground" title={nameDisplay}>{nameDisplay}</h1>
                        {contact.needs_enrichment && <NeedsDetailsMark />}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <RecordStepper prevId={prevContactId} nextId={nextContactId} />
                    {mailto ? (
                        <Button asChild className={TONAL_BUTTON}>
                            <a href={mailto}><Mail className="h-4 w-4" /> Send email</a>
                        </Button>
                    ) : (
                        <Tooltip content="This contact has no email address" position="bottom">
                            <Button disabled className={TONAL_BUTTON}><Mail className="h-4 w-4" /> Send email</Button>
                        </Tooltip>
                    )}
                    {canEdit && (
                        <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More actions" className="text-muted-foreground">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <PermissionMenuItem resource="contacts" action="delete" onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4" /> Delete
                            </PermissionMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {/* The facts under the row scroll away; the row stays. Aligned
                with the name: 32px gutter, 40px avatar, 12px gap. */}
            <div className="hidden pb-4 pl-[5.25rem] pr-8 lg:block">
                <HeaderFacts jobTitle={contact.job_title} company={company} owner={owner} unitName={unitShown ? unitName : null} />
            </div>

            {/* ═══ PHONE HEADER CARD (below lg) ═════════════════════ */}
            <section aria-labelledby="contact-name" className="px-4 pb-4 pt-4 sm:px-6 lg:hidden">
                <div className="flex items-start gap-4">
                    <InitialsAvatar name={contact.full_name} size="xl" />
                    <div className="min-w-0 flex-1">
                        <h2 id="contact-name" className="text-xl font-semibold leading-7 text-foreground break-words">
                            {nameDisplay}
                            {contact.needs_enrichment && <NeedsDetailsMark className="ml-1.5 align-[-3px]" />}
                        </h2>
                        <div className="mt-1">
                            <HeaderFacts jobTitle={contact.job_title} company={company} owner={owner} unitName={unitShown ? unitName : null} />
                        </div>
                    </div>
                </div>
                {(tel || mailto) && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <QuickAction icon={Phone} label="Call" href={tel} missing="No phone number" />
                        <QuickAction icon={MessageCircle} label="WhatsApp" href={whatsApp} external missing="No phone number" />
                        <QuickAction icon={Mail} label="Email" href={mailto} missing="No email address" />
                    </div>
                )}
            </section>

            {/* ═══ TABS ═══════════════════════════════════════════ */}
            <div ref={tabsAnchorRef} aria-hidden="true" />
            <RecordTabs
                ref={tabsRef}
                tabs={CONTACT_TABS}
                value={tab}
                onChange={chooseTab}
                label="Contact views"
                idPrefix="contact"
                className="sticky top-0 z-20 lg:top-14 lg:px-4"
            />

            {/* ═══ OVERVIEW ═══════════════════════════════════════ */}
            <div role="tabpanel" id="contact-panel-overview" aria-labelledby="contact-tab-overview" hidden={tab !== "overview"}>
                <SectionChips links={sectionLinks} active={active} onJump={jumpTo} className="lg:hidden" />
                <div className="flex gap-8 px-4 sm:px-6 lg:px-8 lg:pt-6">
                    {/* Pinned under the header row (56) and the tabs (49), 24px lower. */}
                    <SectionRail links={sectionLinks} active={active} onJump={jumpTo} className="sticky top-[129px] hidden w-[220px] shrink-0 self-start lg:block" />
                    <div className="min-w-0 max-w-[840px] flex-1 space-y-8">
                        <section id={contactSectionDomId("info")} aria-labelledby="contact-info-heading" tabIndex={-1} className="space-y-6 outline-none">
                            <SummaryCard
                                email={contact.email} mailto={mailto}
                                phone={contact.phone} tel={tel} whatsApp={whatsApp}
                                company={company} owner={owner} jobTitle={contact.job_title}
                            />
                            <div>
                                <h2 id="contact-info-heading" className="mb-3 text-base font-semibold text-foreground">Contact information</h2>
                                <div className="rounded-xl border bg-card px-4 py-2 sm:px-5">
                                    <dl>
                                        {filled.map((field) => <Fragment key={field.key}>{field.node}</Fragment>)}
                                    </dl>
                                    {empty.length > 0 && (
                                        <>
                                            {showEmpty && (
                                                <dl id="contact-empty-fields">
                                                    {empty.map((field) => <Fragment key={field.key}>{field.node}</Fragment>)}
                                                </dl>
                                            )}
                                            <button
                                                type="button"
                                                aria-expanded={showEmpty}
                                                aria-controls="contact-empty-fields"
                                                onClick={() => setShowEmpty((open) => !open)}
                                                className="-mx-2 my-1 inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50"
                                            >
                                                {emptyFieldsToggleLabel(empty.length, showEmpty)}
                                                <ChevronDown className={cn("h-4 w-4 transition-transform", showEmpty && "rotate-180")} aria-hidden="true" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section id={contactSectionDomId("notes")} aria-labelledby="contact-notes-heading" tabIndex={-1} className="outline-none">
                            <ContactNotesSection contactId={contact.id} currentUserId={currentUserId} headingId="contact-notes-heading" onCountChange={setNotesCount} />
                        </section>

                        <section id={contactSectionDomId("leads")} aria-labelledby="contact-leads-heading" tabIndex={-1} className="outline-none">
                            <ContactLeadsSection leads={leads} headingId="contact-leads-heading" />
                        </section>

                        <section id={contactSectionDomId("files")} aria-labelledby="contact-files-heading" tabIndex={-1} className="outline-none">
                            <ContactFilesTab contactId={contact.id} headingId="contact-files-heading" onCountChange={setFilesCount} />
                        </section>

                        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                            Last modified {formatDayTime(lastModified || contact.created_at) ?? "—"} by {lastModifiedBy || "System"}
                        </p>
                        <div id={SECTIONS_END_ID} aria-hidden="true" className="h-px" />
                    </div>
                </div>
            </div>

            {/* ═══ TIMELINE ═══════════════════════════════════════ */}
            <div role="tabpanel" id="contact-panel-timeline" aria-labelledby="contact-tab-timeline" hidden={tab !== "timeline"} className="px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
                <div className="max-w-[840px]">
                    {timelineSeen && <ContactTimelineTab contactId={contact.id} />}
                </div>
            </div>

            {/* ═══ DIALOGS ════════════════════════════════════════ */}
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

/** A person as avatar and name: the owner, wherever the page names them. */
function PersonLine({ person }: { person: ContactPerson }) {
    return (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
            <InitialsAvatar name={person.full_name} src={person.avatar_url} size="xs" />
            <span className="truncate">{person.full_name}</span>
        </span>
    )
}

/**
 * What the header says under the name: the job title and the client
 * company (a link to it), then who owns the contact, a person, and, for
 * someone who sees several business units, which one it belongs to.
 */
function HeaderFacts({ jobTitle, company, owner, unitName }: {
    jobTitle: string | null
    company: { id: string; name: string } | null
    owner: ContactPerson | null
    unitName: string | null
}) {
    return (
        <div className="space-y-1 text-sm">
            {(jobTitle || company) && (
                <p className="text-muted-foreground">
                    {jobTitle}
                    {jobTitle && company && " · "}
                    {company && <Link href={`/companies/${company.id}`} className="text-primary hover:underline">{company.name}</Link>}
                </p>
            )}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span className="text-muted-foreground">Owner</span>
                    {owner ? <span className="min-w-0 text-foreground"><PersonLine person={owner} /></span> : <span className="text-muted-foreground">No owner</span>}
                </span>
                {unitName && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="text-muted-foreground">Business unit</span>
                        <span className="truncate text-foreground">{unitName}</span>
                    </span>
                )}
            </p>
        </div>
    )
}

/** ‹ › to the contact before and after this one by name. */
function RecordStepper({ prevId, nextId }: { prevId?: string; nextId?: string }) {
    const step = (id: string | undefined, label: string, Icon: ComponentType<{ className?: string }>) => (
        <Tooltip content={label} position="bottom">
            {id ? (
                <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
                    <Link href={`/contacts/${id}`} prefetch={false} aria-label={label}><Icon className="h-5 w-5" /></Link>
                </Button>
            ) : (
                <Button variant="ghost" size="icon" disabled aria-label={label} className="text-muted-foreground"><Icon className="h-5 w-5" /></Button>
            )}
        </Tooltip>
    )
    return (
        <div className="flex items-center">
            {step(prevId, "Previous contact", ChevronLeft)}
            {step(nextId, "Next contact", ChevronRight)}
        </div>
    )
}

/**
 * An M3 labelled icon button for the phone's header card: a 40dp tonal
 * container over its label (Google Contacts' Call, Text, Email). Without a
 * number or an address it stays in its place, disabled, and says why.
 */
function QuickAction({ icon: Icon, label, href, external = false, missing }: {
    icon: ComponentType<{ className?: string }>
    label: string
    href: string | null
    external?: boolean
    missing: string
}) {
    const body = (
        <>
            <span className="grid h-10 w-16 place-items-center rounded-full bg-[var(--tonal)] text-[var(--tonal-foreground)]">
                <Icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-medium">{label}</span>
        </>
    )
    const base = "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl py-1 text-foreground outline-none"
    if (!href) {
        return (
            <button type="button" disabled title={missing} aria-label={`${label} (${missing.toLowerCase()})`} className={cn(base, "opacity-40")}>
                {body}
            </button>
        )
    }
    return (
        <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={cn(base, "transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50")}
        >
            {body}
        </a>
    )
}

/**
 * Zoho's business card: the five facts a person opens a contact for,
 * each a label beside its value, the reachable ones as links (mail, call,
 * WhatsApp, the company's page). Two pairs to a row once the card is wide.
 */
function SummaryCard({ email, mailto, phone, tel, whatsApp, company, owner, jobTitle }: {
    email: string | null
    mailto: string | null
    phone: string | null
    tel: string | null
    whatsApp: string | null
    company: { id: string; name: string } | null
    owner: ContactPerson | null
    jobTitle: string | null
}) {
    const none = (text: string) => <span className="text-muted-foreground">{text}</span>
    return (
        <div role="group" aria-label="Summary" className="@container rounded-xl border bg-card px-4 py-3.5 sm:px-5">
            <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm leading-5 @xl:grid-cols-[5.5rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="min-w-0 break-words">
                    {mailto && email ? <a href={mailto} className="text-primary hover:underline"><EmailText email={email} /></a> : none("No email")}
                </dd>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="min-w-0">
                    {tel && phone ? (
                        <>
                            <a href={tel} className="text-primary hover:underline">{formatPhoneDisplay(phone)}</a>
                            {whatsApp && (
                                <>
                                    <span className="text-muted-foreground"> · </span>
                                    <a href={whatsApp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                                        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />WhatsApp
                                    </a>
                                </>
                            )}
                        </>
                    ) : phone ? <span className="text-foreground">{phone}</span> : none("No phone")}
                </dd>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="min-w-0 break-words">
                    {company ? <Link href={`/companies/${company.id}`} className="text-primary hover:underline">{company.name}</Link> : none("No company")}
                </dd>
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="min-w-0 text-foreground">{owner ? <PersonLine person={owner} /> : none("No owner")}</dd>
                <dt className="text-muted-foreground">Job title</dt>
                <dd className="min-w-0 break-words text-foreground">{jobTitle || none("No job title")}</dd>
            </dl>
        </div>
    )
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
            <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary" title={meaning}>{code}</span>
                <span>{meaning}</span>
            </span>
            {disc.note && <span className="mt-1 block break-words">{disc.note}</span>}
            {signed && <span className="mt-1 block text-xs text-muted-foreground">{signed}</span>}
        </>
    )
}
