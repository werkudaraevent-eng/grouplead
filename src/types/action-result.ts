/**
 * Unified result type for all Server Actions.
 *
 * @template T - Shape of the `data` payload on success (default: void / no data).
 *
 * Usage:
 *   ActionResult              → { success, error? }
 *   ActionResult<{ id: number }> → { success, error?, data? }
 */
export type ActionResult<T = void> = T extends void
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T }
