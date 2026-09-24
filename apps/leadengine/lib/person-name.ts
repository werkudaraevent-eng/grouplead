/**
 * "Setyorini Dewi Ismu Handayani" → "Setyorini D. I. H.": a phone card's
 * footer has one line beside its action, and a long name lost its ending to
 * an ellipsis. The first name reads as the person, the rest as initials.
 *
 * The same rule as Sales Activity's `shortPersonName`
 * (`apps/sales-mission/components/team-facepile.tsx`), so a person's name is
 * shortened the same way in both apps. The full name stays in the element's
 * title.
 */
export function shortPersonName(name: string, max = 18): string {
    const trimmed = name.trim().replace(/\s+/g, " ")
    if (trimmed.length <= max) return trimmed
    const [first, ...rest] = trimmed.split(" ")
    const initials = rest.map((part) => `${part[0].toUpperCase()}.`).join(" ")
    return initials ? `${first} ${initials}` : first
}
