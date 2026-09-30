/**
 * The drawer's collapse control and its keyboard shortcut. Twin of Sales
 * Activity's lib/ui/sidebar-shortcut.ts, with the labels in English; keep the
 * two in step, because the shortcut is one habit across both apps.
 *
 * `[` folds the drawer to the rail and opens it again, the key Linear and
 * Atlassian use for the same thing. Neither app had a global shortcut, so it
 * clashes with nothing here, and it is a plain key rather than a chord:
 * Cmd+[ is the browser's Back on a Mac and is left alone. On layouts where `[`
 * is typed with AltGr (German, Nordic, Polish…) the browser reports Ctrl+Alt
 * as well, so AltGraph lifts the modifier check instead of blocking the key.
 *
 * The key is ignored wherever it is text or belongs to something else: in a
 * text field, a select or an editable region, and inside an open menu, dialog
 * or listbox, which own their keys (a menu's type-ahead, a dialog's form).
 */

export const SIDEBAR_SHORTCUT = "["

/** What the control is called, in its tooltip and its accessible name. */
export function sidebarToggleLabel(collapsed: boolean): string {
    return collapsed ? "Expand sidebar" : "Collapse sidebar"
}

/** The parts of a KeyboardEvent the decision reads; plain data so it can be tested without a DOM. */
export interface ShortcutKeyEvent {
    key: string
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
    /** AltGr held (`event.getModifierState("AltGraph")`). */
    altGraph?: boolean
    repeat?: boolean
    isComposing?: boolean
    defaultPrevented?: boolean
}

/** Where focus was when the key went down. */
export interface ShortcutTarget {
    /** An input, a textarea, a select or a contenteditable region: the key is text there. */
    editable: boolean
    /** Inside a menu, a dialog, an alert dialog or a listbox. */
    inOverlay: boolean
}

/** True when this keydown should fold or open the drawer. */
export function isSidebarShortcut(event: ShortcutKeyEvent, target: ShortcutTarget): boolean {
    if (event.key !== SIDEBAR_SHORTCUT) return false
    if (event.defaultPrevented || event.isComposing || event.repeat) return false
    if (event.metaKey) return false
    if (!event.altGraph && (event.ctrlKey || event.altKey)) return false
    if (target.editable || target.inOverlay) return false
    return true
}

/** Selectors the hook matches focus against; exported so the two stay one list. */
export const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable='false'])"
export const OVERLAY_SELECTOR = "[role='menu'], [role='dialog'], [role='alertdialog'], [role='listbox']"
