/**
 * The tooltip of a sortable column header (`SortHeader`): what the next
 * click does, and, on the column that holds the list's default order while
 * that order is on, the order itself first ("Urutan bawaan: terdekat dulu.
 * Klik untuk urut jadwal: A ke Z, terlama dulu."). The header shows only its
 * label and arrow, so this is where the default order is said in words.
 */
export function sortTitle({
  label,
  target,
  isDefault,
  hint,
}: {
  /** The column's header, in the product's words. */
  label: string
  /** The direction of the sort the next click sets, as the list's `parts` reads it. */
  target: { direction: string }
  /** The column holds the default order and the list is in it. */
  isDefault: boolean
  /** The default order in words, e.g. "terdekat dulu". */
  hint?: string
}): string {
  const describe =
    target.direction === "asc" ? "A ke Z, terlama dulu" : target.direction === "desc" ? "Z ke A, terbaru dulu" : (hint ?? "urutan bawaan")
  const click = `urut ${label.toLowerCase()}: ${describe}`
  if (isDefault && hint) return `Urutan bawaan: ${hint}. Klik untuk ${click}.`
  return `${click.charAt(0).toUpperCase()}${click.slice(1)}`
}
