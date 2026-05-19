/**
 * Layout self-heal utilities.
 *
 * Form layouts are persisted JSON in `master_options.value`. When the codebase
 * adds a new native field to a `DEFAULT_LAYOUTS` map, tenants who already
 * saved a custom layout will silently miss that field — the form will not
 * render it because it isn't in the saved layout, and the user has no
 * obvious way to add it back without rebuilding their layout.
 *
 * `mergeMissingNativeFields` walks a default layout and reinjects any
 * `native:*` field that is missing from the user's saved layout, preserving
 * visual placement by anchoring to the field's neighbours in the default
 * ordering.
 *
 * Hidden fields are never auto-restored — once a tenant intentionally moves
 * a native field to the Hidden tab we should respect that.
 *
 * The type is declared locally (rather than imported from
 * `form-layout-builder.tsx`) so this module stays free of React/JSX deps and
 * can be exercised by Node's native test runner.
 */

export type LayoutItemsMap = Record<string, string[]>

export function mergeMissingNativeFields(
    saved: LayoutItemsMap,
    defaults: LayoutItemsMap,
): LayoutItemsMap {
    // Shallow-clone tab arrays so we never mutate the caller's input.
    const merged: LayoutItemsMap = {}
    for (const [tab, items] of Object.entries(saved)) {
        merged[tab] = Array.isArray(items) ? [...items] : []
    }

    const allPresent = new Set<string>(Object.values(merged).flat())

    for (const [tabKey, defaultIds] of Object.entries(defaults)) {
        if (tabKey === "hidden") continue // never auto-restore intentionally hidden fields
        for (let idx = 0; idx < defaultIds.length; idx++) {
            const fieldId = defaultIds[idx]
            if (!fieldId.startsWith("native:")) continue
            if (allPresent.has(fieldId)) continue

            if (!merged[tabKey]) merged[tabKey] = []
            const tabItems = merged[tabKey]

            // Anchor placement to the previous default sibling first, then
            // the next default sibling, then push to the end. This keeps the
            // healed layout visually close to the default ordering.
            let inserted = false
            for (let prev = idx - 1; prev >= 0 && !inserted; prev--) {
                const anchor = tabItems.indexOf(defaultIds[prev])
                if (anchor !== -1) {
                    tabItems.splice(anchor + 1, 0, fieldId)
                    inserted = true
                }
            }
            for (let next = idx + 1; next < defaultIds.length && !inserted; next++) {
                const anchor = tabItems.indexOf(defaultIds[next])
                if (anchor !== -1) {
                    tabItems.splice(anchor, 0, fieldId)
                    inserted = true
                }
            }
            if (!inserted) tabItems.push(fieldId)
            allPresent.add(fieldId)
        }
    }

    return merged
}
