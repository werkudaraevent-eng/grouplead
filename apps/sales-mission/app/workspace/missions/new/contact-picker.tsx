"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, UserRound } from "lucide-react"
import { lookupCompanyContacts, type ContactSuggestion } from "@/app/actions/contact-search-actions"
import { CONTACT_SALUTATIONS } from "@/lib/missions/mission-schema"
import { mergeContactFields } from "@/lib/missions/contact-draft"
import { Input } from "@/components/ui/input"

/**
 * Who the visit is with.
 *
 * The company was already linked to its CRM record while the contact was pure
 * free text, even though LeadEngine has known which people belong to which
 * company since March. So a rep opening a mission for a company the CRM has
 * four contacts at was asked to type a name from scratch, and the same person
 * arrived spelled three ways across three missions.
 *
 * Shaped exactly like the company picker above it, because it answers the same
 * kind of question: type freely, and matches appear underneath to be picked.
 * What it must never do is *require* a match. The appointment team books people
 * the CRM has never heard of all the time, and a picker that refuses an unknown
 * name would stop a real visit being scheduled to protect a database.
 */

export interface ContactDraft {
  /** LeadEngine contacts.id, empty when this is a typed name. */
  id: string
  name: string
  jobTitle: string
  phone: string
  email: string
  /**
   * What the CRM held at the moment this contact was picked, so each detail
   * field can say whether it is empty because the CRM is empty. Null when the
   * name was typed rather than picked.
   */
  crm: { jobTitle: string | null; phone: string | null; email: string | null } | null
}

export const EMPTY_CONTACT: ContactDraft = { id: "", name: "", jobTitle: "", phone: "", email: "", crm: null }

export function ContactPicker({
  clientCompanyId,
  value,
  onChange,
  required,
  placeholder,
  selectClassName,
}: {
  /** Null while the company is a typed name, which has nobody attached yet. */
  clientCompanyId: string | null
  value: ContactDraft
  onChange: (next: ContactDraft) => void
  required?: boolean
  placeholder?: string
  selectClassName: string
}) {
  const [contacts, setContacts] = useState<ContactSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetched once per company rather than per keystroke: a company's contact
  // list is short and does not change while the form is open.
  useEffect(() => {
    if (!clientCompanyId) {
      setContacts([])
      return
    }

    let cancelled = false
    setLoading(true)
    lookupCompanyContacts(clientCompanyId)
      .then((result) => { if (!cancelled) setContacts(result.contacts) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [clientCompanyId])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  const typed = value.name.trim().toLowerCase()
  const matches = contacts.filter((contact) =>
    typed.length === 0 ? true : contact.fullName.toLowerCase().includes(typed)
  )

  const pick = (contact: ContactSuggestion) => {
    const incoming = {
      jobTitle: contact.jobTitle ?? null,
      phone: contact.phone ?? null,
      email: contact.email ?? null,
    }

    onChange({
      id: contact.id,
      name: contact.fullName,
      // Fields the previous contact supplied are replaced; fields the rep typed
      // survive. Keeping anything merely non-empty left A's job title and phone
      // sitting under B's name after a correction. See mergeContactFields.
      ...mergeContactFields(
        { jobTitle: value.jobTitle, phone: value.phone, email: value.email },
        value.crm,
        incoming
      ),
      crm: incoming,
    })
    setOpen(false)
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {/* Set only when a CRM contact was chosen. A typed name submits empty,
          which is what keeps the mission honest about what it actually knows. */}
      <input type="hidden" name="contactId" value={value.id} />

      <div className="flex flex-col gap-2 min-[400px]:flex-row">
        <select
          name="contactSalutation"
          defaultValue=""
          aria-label="Sapaan"
          className={selectClassName}
        >
          <option value="">Sapaan</option>
          {CONTACT_SALUTATIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>

        <div className="relative flex-1">
          <Input
            id="field-contact_name"
            name="contactName"
            maxLength={150}
            required={required}
            autoComplete="off"
            placeholder={placeholder ?? "Nama lengkap"}
            value={value.name}
            onChange={(event) => {
              // Editing the name away from the picked person breaks the link:
              // keeping the id would attach this visit to someone else. The
              // details go with them, because a value pulled from that contact
              // only ever made sense while attached to it. Anything the rep
              // typed themselves stays.
              onChange({
                ...value,
                id: "",
                name: event.target.value,
                ...(value.crm
                  ? mergeContactFields(
                      { jobTitle: value.jobTitle, phone: value.phone, email: value.email },
                      value.crm,
                      null
                    )
                  : {}),
                crm: null,
              })
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            className="h-12 pr-10"
          />

          {value.id && (
            <Check
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--success-foreground)]"
              aria-hidden="true"
            />
          )}
          {loading && !value.id && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}

          {open && matches.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
              {matches.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => pick(contact)}
                    className="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{contact.fullName}</span>
                      {contact.jobTitle && (
                        <span className="block truncate text-xs text-muted-foreground">{contact.jobTitle}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Says which of the three states this field is in, because "is this
          person in the CRM" is exactly what the rep cannot otherwise tell. */}
      {value.id ? (
        <p className="text-xs text-[var(--success-foreground)]">Tertaut ke kontak di LeadEngine.</p>
      ) : !clientCompanyId ? (
        <p className="text-xs text-muted-foreground">
          Pilih perusahaan dari CRM lebih dulu untuk melihat kontak yang sudah terdaftar.
        </p>
      ) : contacts.length === 0 && !loading ? (
        <p className="text-xs text-muted-foreground">
          Perusahaan ini belum punya kontak di CRM. Ketik namanya, nanti bisa didaftarkan saat lead dikirim.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {contacts.length} kontak terdaftar di CRM. Ketik untuk mencari, atau tulis nama baru.
        </p>
      )}
    </div>
  )
}
