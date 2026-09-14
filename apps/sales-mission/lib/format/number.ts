/**
 * Numbers the way Indonesians read them: dots for thousands, a comma for
 * decimals. "300000000" is a count of zeros; "300.000.000" is a number.
 */

/** Format an integer or decimal with id-ID separators. */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ""
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value)
}

/** Parse what a person typed, tolerating dots as separators and a comma as the decimal mark. */
export function parseNumber(raw: string, decimals = 0): number | null {
  const cleaned = raw.replace(/[^\d,]/g, "")
  if (!cleaned) return null
  const [whole, fraction = ""] = cleaned.split(",")
  const digits = whole.replace(/\D/g, "")
  if (!digits && !fraction) return null
  const text = decimals > 0 && fraction ? `${digits || "0"}.${fraction.slice(0, decimals)}` : digits || "0"
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * What to show while typing. Reformats the whole part on every keystroke
 * (unambiguous, so Material allows it) and leaves a trailing comma or
 * partial fraction alone so a decimal can be typed at all.
 */
export function formatNumberWhileTyping(raw: string, decimals = 0): string {
  const cleaned = raw.replace(/[^\d,]/g, "")
  if (!cleaned) return ""
  const [whole, ...rest] = cleaned.split(",")
  const digits = whole.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  const grouped = digits ? formatNumber(Number(digits)) : "0"
  if (decimals === 0 || rest.length === 0) return digits ? grouped : ""
  return `${grouped},${rest.join("").slice(0, decimals)}`
}
