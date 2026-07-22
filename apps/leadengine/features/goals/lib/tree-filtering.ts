import type { GoalNode, GoalNodeTree } from '@/types/goals'

/**
 * Builds a tree from flat goal_nodes array.
 */
function buildTree(nodes: GoalNode[]): GoalNodeTree[] {
  const map = new Map<string, GoalNodeTree>()
  const roots: GoalNodeTree[] = []
  for (const n of nodes) map.set(n.id, { ...n, children: [] })
  for (const n of nodes) {
    const tree = map.get(n.id)!
    if (n.parent_node_id && map.has(n.parent_node_id)) {
      map.get(n.parent_node_id)!.children.push(tree)
    } else {
      roots.push(tree)
    }
  }
  const sortChildren = (items: GoalNodeTree[]) => {
    items.sort((a, b) => a.sort_order - b.sort_order)
    for (const item of items) sortChildren(item.children)
  }
  sortChildren(roots)
  return roots
}

/**
 * Filters a goal_nodes tree to a specific subsidiary's subtree.
 *
 * Finds root-level nodes where reference_field = 'company_id' and
 * reference_value matches the given subsidiaryId. Returns those subtrees
 * with their full internal hierarchy preserved.
 *
 * If subsidiaryId is null/undefined (holding view), returns the complete tree.
 */
export function filterTreeBySubsidiary(
  allNodes: GoalNode[],
  subsidiaryId: string | null | undefined
): GoalNodeTree[] {
  const tree = buildTree(allNodes)

  // Holding view — return complete tree
  if (!subsidiaryId) return tree

  // Find root-level nodes matching the subsidiary
  const filtered: GoalNodeTree[] = []
  for (const root of tree) {
    if (root.reference_field === 'company_id' && root.reference_value === subsidiaryId) {
      filtered.push(root)
    }
  }

  return filtered
}

/**
 * Collects all node IDs in a subtree (inclusive of root).
 */
export function collectSubtreeIds(tree: GoalNodeTree[]): Set<string> {
  const ids = new Set<string>()
  const walk = (nodes: GoalNodeTree[]) => {
    for (const node of nodes) {
      ids.add(node.id)
      walk(node.children)
    }
  }
  walk(tree)
  return ids
}
