"use client"

import { toast } from "sonner"
import { ChevronDown, ClipboardList, Mail, MessageCircle, Phone } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { ResponsiveMenu, type MenuEntry } from "@/components/responsive-menu"
import { useCompact } from "@/hooks/use-compact"
import { formatPhone } from "@/lib/format/phone"
import { whatsAppLink } from "@/lib/prospects/whatsapp-greeting"
import { rememberPendingFollowUp } from "@/lib/prospects/follow-up-pending"
import type { Channel } from "@/lib/prospects/prospect-schema"

/**
 * "Hubungi": the prospect's channels, then the log.
 *
 * The old button offered the bookkeeping ("Catat kontak") and nobody pressed
 * it: reps called from WhatsApp outside the app and never came back to
 * write it down. So the button is the call itself, the way HubSpot and
 * Pipedrive put Call / WhatsApp / Email on the record and ask about the
 * outcome afterwards. WhatsApp opens the chat with the unit's opening line
 * filled in (the app on a phone, WhatsApp Web or Desktop on a desk).
 * Telepon dials on a phone; on a desk, where most computers have nothing
 * to dial with, it copies the number and says so. Each remembers the
 * follow-up it started, so the prompt can ask "Bagaimana hasilnya?" when
 * the person is back. "Catat follow-up" stays for what happened outside
 * the app: the client who called first, a chat at an event.
 */
export function ContactMenu({
  prospectId,
  label,
  statusId,
  phone,
  email,
  greeting,
  onLog,
  size = "sm",
  className,
}: {
  prospectId: string
  /** "Company · Contact", for the sheet's title and the prompt's subtitle. */
  label: string
  statusId: string
  phone?: string | null
  email?: string | null
  /** The rendered WhatsApp opening line. */
  greeting: string
  /** Open the full log dialog. */
  onLog: () => void
  size?: "sm" | "default"
  className?: string
}) {
  const compact = useCompact()
  const remember = (channel: Channel) => rememberPendingFollowUp({ prospectId, label, statusId, channel })

  if (!phone && !email) {
    return (
      <Button size={size} variant="tonal" className={className} onClick={onLog}>
        <ClipboardList className="h-4 w-4" /> Catat follow-up
      </Button>
    )
  }

  const items: MenuEntry[] = [
    phone
      ? {
          label: "WhatsApp",
          icon: MessageCircle,
          onSelect: () => {
            remember("WHATSAPP")
            window.open(whatsAppLink(phone, greeting), "_blank", "noopener")
          },
        }
      : null,
    phone
      ? {
          label: `Telepon ${formatPhone(phone)}`,
          icon: Phone,
          onSelect: () => {
            remember("PHONE")
            if (!compact) {
              // A desk rarely dials; the number in the clipboard is the
              // honest help, and tel: still works where Phone Link or
              // FaceTime is set up.
              navigator.clipboard
                ?.writeText(formatPhone(phone))
                .then(() => toast.message("Nomor disalin", { description: "Telepon dari HP, lalu catat hasilnya di sini." }))
                .catch(() => {})
            }
            window.location.href = `tel:${phone}`
          },
        }
      : null,
    email
      ? {
          label: "Email",
          icon: Mail,
          onSelect: () => {
            remember("EMAIL")
            window.location.href = `mailto:${email}`
          },
        }
      : null,
    { kind: "divider" },
    { label: "Catat follow-up", icon: ClipboardList, onSelect: onLog },
  ]

  return (
    <ResponsiveMenu
      title={`Hubungi ${label}`}
      items={items}
      trigger={
        <Button size={size} variant="tonal" className={className} aria-label={`Hubungi ${label}`}>
          <Phone className="h-4 w-4" /> Hubungi <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
        </Button>
      }
    />
  )
}
