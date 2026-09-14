/**
 * Indonesian phone numbers: accept loosely, store one way, show one way.
 *
 * Material's advice for a phone field is not a rigid mask (people paste
 * "+62 812-3456-7890" and "0812 3456 7890" and both are right) but a field
 * that accepts what is typed, keeps only the digits, and shows them back in
 * a recognisable grouping. Stored form is E.164 ("+628123456789") so the
 * CRM, WhatsApp links and dialers all agree.
 */

/** Digits with an optional leading +, nothing else. */
export function phoneDigits(raw: string): string {
  const trimmed = raw.trim()
  const plus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  return plus ? `+${digits}` : digits
}

/**
 * Normalise to E.164 for Indonesia: "0812…" → "+62812…", "62812…" → "+62812…",
 * "+62 812…" → "+62812…". A number that already carries another country code
 * is kept as typed (with the +). Returns "" for blank input.
 */
export function normalizePhone(raw: string): string {
  const digits = phoneDigits(raw)
  if (!digits) return ""
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("62")) return `+${digits}`
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`
  // Bare local number without the leading zero, e.g. "812…": assume Indonesia.
  return `+62${digits}`
}

/** Whether a normalised number has a plausible length: 8–15 digits after the +. */
export function isValidPhone(raw: string): boolean {
  const normalised = normalizePhone(raw)
  if (!normalised) return true
  const length = normalised.replace(/\D/g, "").length
  return length >= 9 && length <= 15
}

/**
 * Display grouping: "+62 812-3456-7890". Indonesian mobiles are read in
 * groups of four after the operator prefix; landlines with an area code get
 * "+62 21-1234-5678". Anything not Indonesian is shown as "+CC digits".
 */
export function formatPhone(raw: string): string {
  const normalised = normalizePhone(raw)
  if (!normalised) return ""
  if (!normalised.startsWith("+62")) return normalised
  const rest = normalised.slice(3)
  // Mobiles start with 8 and carry a three-digit operator prefix; area codes
  // are two or three digits and are not shown with the leading zero.
  const head = rest.startsWith("8") ? rest.slice(0, 3) : rest.slice(0, rest.startsWith("2") || rest.startsWith("3") ? 2 : 3)
  const tail = rest.slice(head.length)
  const groups = tail.match(/.{1,4}/g) ?? []
  return `+62 ${head}${groups.length ? "-" + groups.join("-") : ""}`
}

/**
 * What to show while typing: format only once there is enough to be
 * unambiguous, so the caret does not jump around on the first digits.
 */
export function formatPhoneWhileTyping(raw: string): string {
  const digits = phoneDigits(raw)
  const count = digits.replace(/\D/g, "").length
  return count >= 6 ? formatPhone(digits) : digits
}
