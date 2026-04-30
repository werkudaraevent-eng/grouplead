/**
 * Lead Field Registry — LEGACY re-export.
 *
 * All types and the static registry are now defined in dimension-registry.ts.
 * This file exists for backward compatibility so existing imports
 * (`from '@/config/lead-field-registry'`) continue to work.
 */

export { LEAD_FIELD_REGISTRY } from './dimension-registry'
export type { LeadFieldEntry, ValueSource } from './dimension-registry'
