/**
 * Client-company hierarchy helpers.
 *
 * Client companies form a self-referential tree via `parent_id`. Depth is
 * unbounded (a subsidiary can itself be a parent), so every traversal here is
 * cycle-safe via a visited set — a corrupt chain (A → B → A) must never cause
 * an infinite loop.
 *
 * These are pure functions over an in-memory list so they can be unit tested
 * and reused by both the lead-form contact cascade and the company parent
 * picker without extra DB round-trips.
 */

export interface HierarchyNode {
    id: string
    parent_id?: string | null
}

/**
 * Return the ids of every descendant of `rootId` (children, grandchildren, …),
 * NOT including `rootId` itself. Order is breadth-first. Cycle-safe.
 */
export function getDescendantCompanyIds<T extends HierarchyNode>(
    companies: T[],
    rootId: string,
): string[] {
    // Index children by parent for O(n) traversal instead of O(n²) scans.
    const childrenByParent = new Map<string, string[]>()
    for (const c of companies) {
        if (c.parent_id) {
            const list = childrenByParent.get(c.parent_id)
            if (list) list.push(c.id)
            else childrenByParent.set(c.parent_id, [c.id])
        }
    }

    const result: string[] = []
    const visited = new Set<string>([rootId]) // guard against cycles
    const queue: string[] = [...(childrenByParent.get(rootId) ?? [])]

    while (queue.length > 0) {
        const id = queue.shift()!
        if (visited.has(id)) continue
        visited.add(id)
        result.push(id)
        const children = childrenByParent.get(id)
        if (children) queue.push(...children)
    }

    return result
}

/**
 * Return the ids of every ancestor of `nodeId` (parent, grandparent, …),
 * NOT including `nodeId` itself. Order is nearest-first. Cycle-safe.
 */
export function getAncestorCompanyIds<T extends HierarchyNode>(
    companies: T[],
    nodeId: string,
): string[] {
    const byId = new Map<string, T>()
    for (const c of companies) byId.set(c.id, c)

    const result: string[] = []
    const visited = new Set<string>([nodeId])
    let current = byId.get(nodeId)?.parent_id ?? null

    while (current && !visited.has(current)) {
        visited.add(current)
        result.push(current)
        current = byId.get(current)?.parent_id ?? null
    }

    return result
}

/**
 * Ids that may NOT be chosen as a parent for `nodeId`: the node itself plus
 * all of its descendants. Selecting any of these would create a cycle.
 * For a brand-new company (no id yet), pass `null` → returns an empty set.
 */
export function getInvalidParentIds<T extends HierarchyNode>(
    companies: T[],
    nodeId: string | null,
): Set<string> {
    if (!nodeId) return new Set()
    return new Set<string>([nodeId, ...getDescendantCompanyIds(companies, nodeId)])
}

/**
 * Depth of `nodeId` in the tree (0 = top-level / no parent). Cycle-safe.
 */
export function getHierarchyDepth<T extends HierarchyNode>(
    companies: T[],
    nodeId: string,
): number {
    return getAncestorCompanyIds(companies, nodeId).length
}
