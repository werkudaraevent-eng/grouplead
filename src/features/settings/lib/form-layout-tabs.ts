export type TabSetting = {
    label: string
    isHidden: boolean
    sortOrder: number
}

export type TabSettingsMap = Record<string, TabSetting>

export type LayoutItemsMap = Record<string, string[]>

export type VisibilityCondition = {
    dependsOn: string
    operator: "equals" | "not_equals" | "contains" | "starts_with" | "in" | "not_empty"
    value: string | string[]
}

export type VisibilityRule = {
    logic: "and" | "or"
    conditions: VisibilityCondition[]
}

export type VisibilityRules = Record<string, VisibilityRule>

export function buildLayoutStateSnapshot(
    tabs: LayoutItemsMap,
    requiredOverrides: string[],
    visibilityRules: VisibilityRules,
    tabSettings: TabSettingsMap
) {
    return JSON.stringify({
        tabs,
        req: requiredOverrides,
        vis: visibilityRules,
        tabSettings,
    })
}

export function formatTabLabel(tabId: string) {
    return tabId
        .split("_")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

export function createTabId(label: string) {
    return label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
}

export function getVisibleTabIds(items: LayoutItemsMap, tabSettings: TabSettingsMap) {
    return Object.keys(items)
        .filter(tabId => tabId !== "hidden" && !tabSettings[tabId]?.isHidden)
        .sort((a, b) => (tabSettings[a]?.sortOrder ?? 0) - (tabSettings[b]?.sortOrder ?? 0))
}

export function getVisibleTabEntries(items: LayoutItemsMap, tabSettings: TabSettingsMap) {
    return getVisibleTabIds(items, tabSettings).map(tabId => [tabId, items[tabId] || []] as const)
}

export function getFirstVisibleTabId(items: LayoutItemsMap, tabSettings: TabSettingsMap) {
    return getVisibleTabIds(items, tabSettings)[0]
}
