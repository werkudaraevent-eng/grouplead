/**
 * Unified result type for all Server Actions. Mirrors LeadEngine's contract so
 * the two apps read the same way.
 *
 * @template T - Shape of the `data` payload on success (default: void / no data).
 *
 * Usage:
 *   ActionResult                 → { success, error? }
 *   ActionResult<{ id: string }> → { success, error?, data? }
 */
export type ActionResult<T = void> = T extends void
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T }
