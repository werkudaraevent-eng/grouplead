/**
 * A seen mark's key in public.user_hints: a short slug chosen in code. The
 * table's CHECK agrees (migration 20260923110000_leadengine_announcements.sql),
 * so a key the app writes is never refused by the database.
 */
export const HINT_KEY = /^[a-z0-9][a-z0-9_-]{0,59}$/
