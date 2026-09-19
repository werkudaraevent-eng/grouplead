/**
 * DISC as a note on how to talk to a person.
 *
 * The team's sales training teaches DISC (Dominance, Influence, Steadiness,
 * Conscientiousness) as a way to read a client and adjust the approach. The
 * app keeps that reading on the contact, as the rep's estimate after a
 * meeting, never as a diagnosis: a primary letter, an optional secondary
 * one, and a line in the rep's own words. Optional everywhere, switched on
 * per unit, internal only. Crystal Knows and Humantic AI put the same badge
 * next to a contact's name in HubSpot and Salesforce, with a "how to
 * communicate" summary behind it; this is that, in the training's words.
 */

import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

export const DISC_LETTERS = ["D", "I", "S", "C"] as const
export type DiscLetter = (typeof DISC_LETTERS)[number]

export interface DiscProfile {
  name: string
  /** How the person tends to come across. */
  trait: string
  /** How to approach them, from the training. */
  approach: string
  /** What the letter adds when it is the secondary one. */
  secondary: string
}

export const DISC_PROFILES: Record<DiscLetter, DiscProfile> = {
  D: {
    name: "Dominance",
    trait: "Langsung, cepat memutuskan, fokus pada hasil.",
    approach: "Langsung ke inti, tunjukkan hasil dan angka, beri dua atau tiga pilihan, jangan bertele-tele, dan biarkan dia yang memutuskan.",
    secondary: "tetap ringkas dan berorientasi hasil",
  },
  I: {
    name: "Influence",
    trait: "Ramah, antusias, suka bercerita dan menjaga hubungan.",
    approach: "Bangun hubungan dulu, tunjukkan antusiasme, ceritakan kisah sukses klien lain, jangan tenggelam di detail, dan pastikan tindak lanjut tertulis.",
    secondary: "sisihkan waktu untuk obrolan dan hubungan",
  },
  S: {
    name: "Steadiness",
    trait: "Tenang, sabar, mengutamakan rasa aman dan konsistensi.",
    approach: "Jangan terburu-buru, beri jaminan dan bukti, tunjukkan dukungan jangka panjang, dan beri waktu untuk memutuskan.",
    secondary: "beri rasa aman dan jangan mendesak",
  },
  C: {
    name: "Conscientiousness",
    trait: "Teliti, analitis, butuh data dan detail sebelum yakin.",
    approach: "Siapkan data, spesifikasi dan referensi, jawab pertanyaan detail dengan tepat, hindari klaim berlebihan, dan beri waktu menelaah.",
    secondary: "siapkan detail dan data pendukung",
  },
}

export function isDiscLetter(value: unknown): value is DiscLetter {
  return typeof value === "string" && (DISC_LETTERS as readonly string[]).includes(value)
}

/** "DI", "S", or "" when nothing was assessed. */
export function discCode(primary: DiscLetter | null | undefined, secondary?: DiscLetter | null): string {
  if (!primary) return ""
  return secondary && secondary !== primary ? `${primary}${secondary}` : primary
}

/** The approach line the form and the badge show, from the training's words. */
export function describeDisc(primary: DiscLetter | null | undefined, secondary?: DiscLetter | null): string {
  if (!primary) return ""
  const main = DISC_PROFILES[primary]
  const side = secondary && secondary !== primary ? DISC_PROFILES[secondary] : null
  return side ? `${main.approach} Ada sisi ${side.name}: ${side.secondary}.` : main.approach
}

/** A pair the form may store: a primary, and a secondary that differs from it. */
export function normalizeDisc(primary: unknown, secondary: unknown): { primary: DiscLetter | null; secondary: DiscLetter | null } {
  const first = isDiscLetter(primary) ? primary : null
  const second = first && isDiscLetter(secondary) && secondary !== first ? secondary : null
  return { primary: first, secondary: second }
}

/** "dinilai oleh Setyorini, 12 Sep 2026", or "" without a name. The date is optional. */
export function describeAssessment(name: string | null | undefined, at: string | null | undefined): string {
  if (!name) return ""
  const when = at ? new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(new Date(at)) : ""
  return when ? `dinilai oleh ${name}, ${when}` : `dinilai oleh ${name}`
}
