import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { normalizePhone } from "@/lib/format/phone"

/**
 * The opening line of a WhatsApp chat started from a prospect.
 *
 * A template the unit's admin may edit (Pengaturan → Aktivitas → Prospek);
 * empty means this default. Four placeholders, in the team's words rather
 * than code's: {sapaan} is the time of day, {kontak} the person addressed,
 * {sales} whoever is writing, {perusahaan} the unit. Short on purpose: it
 * saves the typing, not the conversation, so the rep does not sound like a
 * machine.
 */
export const DEFAULT_WHATSAPP_GREETING = "{sapaan} {kontak}, saya {sales} dari {perusahaan}."

export const GREETING_PLACEHOLDERS: ReadonlyArray<{ token: string; means: string }> = [
  { token: "{sapaan}", means: "Selamat pagi / siang / sore / malam, mengikuti jam" },
  { token: "{kontak}", means: "sapaan dan nama kontak, misalnya Bapak Nuryono" },
  { token: "{sales}", means: "nama sales yang mengirim" },
  { token: "{perusahaan}", means: "nama unit bisnis" },
]

/** "Selamat pagi" through "Selamat malam", by the hour in mission time. */
export function timeOfDayGreeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now)
  )
  if (hour < 11) return "Selamat pagi"
  if (hour < 15) return "Selamat siang"
  if (hour < 18) return "Selamat sore"
  return "Selamat malam"
}

/** "Bapak Nuryono"; "Bapak/Ibu Nuryono" when the salutation is unknown; "Bapak/Ibu" when the name is too. */
export function addressContact(salutation: string | null | undefined, name: string | null | undefined): string {
  const who = (name ?? "").trim()
  const how = (salutation ?? "").trim() || "Bapak/Ibu"
  return who ? `${how} ${who}` : how
}

export function renderWhatsAppGreeting(
  template: string | null | undefined,
  vars: { contact: string; sales: string; company: string; now?: Date }
): string {
  const source = template?.trim() || DEFAULT_WHATSAPP_GREETING
  return source
    .replace(/\{sapaan\}/g, timeOfDayGreeting(vars.now ?? new Date()))
    .replace(/\{kontak\}/g, vars.contact)
    .replace(/\{sales\}/g, vars.sales)
    .replace(/\{perusahaan\}/g, vars.company)
    .replace(/[ \t]+/g, " ")
    .trim()
}

/**
 * WhatsApp's click-to-chat link: opens the app on a phone, WhatsApp Web or
 * Desktop on a desk. wa.me wants the country code and no plus, so a local
 * "0812…" (an imported number that skipped normalisation) becomes "62812…".
 */
export function whatsAppLink(phone: string, text?: string): string {
  const digits = normalizePhone(phone).replace(/^\+/, "")
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`
}
