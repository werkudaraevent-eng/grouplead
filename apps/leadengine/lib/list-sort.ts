export type SortState = { key: string; direction: "asc" | "desc" } | null

/**
 * One click per step: a new column sorts ascending, the same column then
 * descending, and a third click hands the list back to its default order
 * (name A to Z). Toggling only between the two directions left no way back
 * short of reloading the page. Sales Activity's headers cycle the same way,
 * as do MUI Data Grid, AG Grid and Airtable.
 */
export function nextSort(current: SortState, key: string): SortState {
  if (current?.key !== key) return { key, direction: "asc" }
  return current.direction === "asc" ? { key, direction: "desc" } : null
}
