import type { GoalNode, GoalSegment } from '@/types/goals'
import { classifyLeadBySegment } from '@/features/goals/lib/classification-engine'
import { LEAD_FIELD_REGISTRY } from '@/config/lead-field-registry'

/**
 * Builds the ancestor path for a node — the ordered list of
 * { reference_field, reference_value } pairs from root to node.
 */
export function buildAncestorPath(
  nodeId: string,
  allNodes: GoalNode[]
): { reference_field: string; reference_value: string }[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]))
  const path: { reference_field: string; reference_value: string }[] = []

  let current = nodeMap.get(nodeId)
  while (current) {
    path.unshift({
      reference_field: current.reference_field,
      reference_value: current.reference_value,
    })
    current = current.parent_node_id ? nodeMap.get(current.parent_node_id) : undefined
  }

  return path
}

/**
 * Resolves a lead's field value for a given reference_field.
 * Handles segment: prefix, client_company_field, and direct lead fields.
 */
function resolveFieldValue(
  lead: Record<string, unknown>,
  referenceField: string,
  segments: GoalSegment[],
  clientCompany: Record<string, unknown> | null
): string | null {
  // Segment reference — classify via GoalSegment mappings
  if (referenceField.startsWith('segment:')) {
    const segmentId = referenceField.replace('segment:', '')
    const segment = segments.find((s) => s.id === segmentId)
    if (!segment) return null

    // Resolve the raw value through the segment's source_field
    const rawValue = resolveFieldValue(lead, segment.source_field, [], clientCompany)
    return classifyLeadBySegment(rawValue, segment)
  }

  // Check registry for special value sources
  const entry = LEAD_FIELD_REGISTRY.find((f) => f.key === referenceField)

  if (entry) {
    const src = entry.valueSource
    switch (src.type) {
      case 'client_company_field': {
        if (!clientCompany) return null
        const col = (src as { type: 'client_company_field'; column: string }).column
        const raw = clientCompany[col]
        return raw != null && raw !== '' ? String(raw) : null
      }
      case 'client_companies': {
        if (!clientCompany) return null
        const id = clientCompany['id']
        return id != null ? String(id) : null
      }
      case 'subsidiaries': {
        const raw = lead['company_id']
        return raw != null ? String(raw) : null
      }
      case 'profiles': {
        const raw = lead['pic_sales_id']
        return raw != null ? String(raw) : null
      }
      default: {
        const raw = lead[referenceField]
        return raw != null && raw !== '' ? String(raw) : null
      }
    }
  }

  // Fallback: direct lead field access
  const raw = lead[referenceField]
  return raw != null && raw !== '' ? String(raw) : null
}

/**
 * Determines if a lead matches a node by checking the lead's field values
 * against every ancestor's reference_field/reference_value in the path.
 * Empty ancestor path = root match → returns true.
 * Returns false for NULL required fields.
 */
export function matchLeadToNode(
  lead: Record<string, unknown>,
  ancestorPath: { reference_field: string; reference_value: string }[],
  segments: GoalSegment[],
  clientCompany: Record<string, unknown> | null
): boolean {
  if (ancestorPath.length === 0) return true

  for (const ancestor of ancestorPath) {
    const leadValue = resolveFieldValue(lead, ancestor.reference_field, segments, clientCompany)
    if (leadValue == null) return false
    if (leadValue !== ancestor.reference_value) return false
  }

  return true
}

/**
 * Returns all leaf node IDs that a lead contributes to.
 * A leaf node is one with no children in the allNodes array.
 */
export function findLeadNodePaths(
  lead: Record<string, unknown>,
  allNodes: GoalNode[],
  segments: GoalSegment[],
  clientCompany: Record<string, unknown> | null
): string[] {
  if (allNodes.length === 0) return []

  // Identify leaf nodes (nodes that are not a parent of any other node)
  const parentIds = new Set(
    allNodes.filter((n) => n.parent_node_id).map((n) => n.parent_node_id!)
  )
  const leafNodes = allNodes.filter((n) => !parentIds.has(n.id))

  const matchedIds: string[] = []

  for (const leaf of leafNodes) {
    const path = buildAncestorPath(leaf.id, allNodes)
    if (matchLeadToNode(lead, path, segments, clientCompany)) {
      matchedIds.push(leaf.id)
    }
  }

  return matchedIds
}
