/**
 * Which CRM category a visit's interest level suggests.
 *
 * LeadEngine's categories (HQL, Hot Lead, Warm Lead, Cold Lead) are Master
 * Options an admin can rename or extend, so nothing here names a value.
 * The report's interest kind (hot/warm/cold) is matched against the
 * fetched options by the word each carries, in English or Indonesian, and
 * the person can still pick anything else, HQL included, before sending.
 */

export interface LeadOption {
  label: string
  value: string
}

const WORDS: Record<string, string[]> = {
  hot: ["hot", "panas"],
  warm: ["warm", "hangat"],
  cold: ["cold", "dingin"],
}

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/** The option value that matches the interest kind, or null when none does. */
export function suggestCategory(options: LeadOption[], kind: string | null | undefined): string | null {
  const words = kind ? WORDS[kind] : undefined
  if (!words) return null
  const match = options.find((option) => {
    const haystack = `${normalise(option.label)} ${normalise(option.value)}`.split(" ")
    return words.some((word) => haystack.includes(word))
  })
  return match?.value ?? null
}

/** The label to show for a stored value; the value itself when the option is gone. */
export function optionLabel(options: LeadOption[], value: string | null | undefined): string | null {
  if (!value) return null
  return options.find((option) => option.value === value)?.label ?? value
}
