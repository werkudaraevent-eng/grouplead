import { LEAD_FIELD_REGISTRY } from '@/config/lead-field-registry'
import type { BreakdownLevelConfig, BreakdownTargets, GoalSegment } from '@/types/goals'
import { classifyLeadBySegment } from './classification-engine'

// ── Interfaces ──

/** Alias kept for internal use — aligns with BreakdownLevelConfig */
export type BreakdownLevel = BreakdownLevelConfig

export interface TreeNodeData {
  id: string
  name: string
  level: number
  fieldKey: string
  wonRevenue: number
  pipelineValue: number
  target: number
  children: TreeNodeData[] | null
  leadIds: number[]
}

/** Shape of a lead row from the comprehensive query */
export type LeadRow = {
  id: number
  actual_value: number | null
  estimated_value: number | null
  pipeline_stage: { stage_type: string; closed_status: string | null } | null
  client_company_id: string | null
  client_company: { id: string; name: string; line_industry?: string | null; [key: string]: unknown } | null
  pic_sales_id: string | null
  pic_sales_profile: { id: string; full_name: string } | null
  category: string | null
  lead_source: string | null
  main_stream: string | null
  grade_lead: string | null
  stream_type: string | null
  business_purpose: string | null
  tipe: string | null
  nationality: string | null
  sector: string | null
  area: string | null
  referral_source: string | null
  event_format: string | null
  [key: string]: unknown
}

// ── Segment Source Field Registry ──

/**
 * Maps segment ID → source_field, populated from GoalSegment records.
 * Used by resolveLeadValue to look up the raw field for a segment level.
 */
let _segmentSourceFields: Map<string, string> = new Map()

export function setDimensionSourceFields(segments: GoalSegment[] | Map<string, string>) {
  if (segments instanceof Map) {
    _segmentSourceFields = segments
  } else {
    _segmentSourceFields = new Map(segments.map((s) => [s.id, s.source_field]))
  }
}

export function getDimensionSourceField(fieldKey: string): string | null {
  const segmentId = fieldKey.replace('segment:', '')
  return _segmentSourceFields.get(segmentId) ?? null
}

// ── Utility Functions ──

/**
 * Resolves the raw string value for a field key from a lead row,
 * respecting the registry's valueSource (e.g. client_company_field
 * reads from lead.client_company[column], not directly from lead).
 */
function resolveRawFieldValue(lead: LeadRow, fieldKey: string): string | null {
  const entry = LEAD_FIELD_REGISTRY.find((f) => f.key === fieldKey)
  if (!entry) {
    const raw = (lead as Record<string, unknown>)[fieldKey]
    return raw != null && raw !== '' ? String(raw) : null
  }

  const src = entry.valueSource
  switch (src.type) {
    case 'client_company_field': {
      const col = (src as { type: 'client_company_field'; column: string }).column
      const raw = lead.client_company?.[col] ?? null
      return raw != null && raw !== '' ? String(raw) : null
    }
    case 'client_companies':
      return lead.client_company?.name ?? null
    case 'subsidiaries':
      return (lead as Record<string, unknown>).company_id as string | null
    case 'profiles':
      return lead.pic_sales_id ?? null
    default: {
      const raw = (lead as Record<string, unknown>)[fieldKey]
      return raw != null && raw !== '' ? String(raw) : null
    }
  }
}

export function isFieldAvailable(
  fieldKey: string,
  currentLevels: BreakdownLevel[]
): boolean {
  return !currentLevels.some((l) => l.field === fieldKey)
}

/**
 * Resolves a lead's key+label for a given breakdown level.
 * For segment levels, classifies via GoalSegment mappings.
 */
export function resolveLeadValue(
  lead: LeadRow,
  level: BreakdownLevel,
  segments: GoalSegment[]
): { key: string; label: string } {
  const { field: fieldKey } = level

  // Segment dimension — classify via GoalSegment
  if (fieldKey.startsWith('segment:')) {
    const segmentId = fieldKey.replace('segment:', '')
    const segment = segments.find((s) => s.id === segmentId)
    if (!segment) return { key: 'unassigned', label: 'Unassigned' }

    // Resolve raw value through the registry's valueSource
    // (e.g. line_industry lives on client_company, not directly on lead)
    const rawValue = resolveRawFieldValue(lead, segment.source_field)
    const classified = classifyLeadBySegment(
      rawValue != null ? String(rawValue) : null,
      segment
    )
    return { key: classified, label: classified }
  }

  const entry = LEAD_FIELD_REGISTRY.find((f) => f.key === fieldKey)
  if (!entry) {
    const raw = (lead as Record<string, unknown>)[fieldKey]
    if (raw == null || raw === '') return { key: 'unassigned', label: 'Unassigned' }
    return { key: String(raw), label: String(raw) }
  }

  const src = entry.valueSource

  switch (src.type) {
    case 'client_companies': {
      const id = lead.client_company?.id ?? null
      const name = lead.client_company?.name ?? null
      if (!id) return { key: 'unassigned', label: 'Unassigned' }
      return { key: id, label: name || 'Unassigned' }
    }
    case 'client_company_field': {
      const col = (src as { type: 'client_company_field'; column: string }).column
      const raw = lead.client_company?.[col] ?? null
      if (raw == null || raw === '') return { key: 'unassigned', label: 'Unassigned' }
      return { key: String(raw), label: String(raw) }
    }
    case 'subsidiaries': {
      const id = (lead as Record<string, unknown>).company_id ?? null
      if (!id) return { key: 'unassigned', label: 'Unassigned' }
      return { key: String(id), label: String(id) }
    }
    case 'profiles': {
      const id = lead.pic_sales_id ?? null
      const name = lead.pic_sales_profile?.full_name ?? null
      if (!id) return { key: 'unassigned', label: 'Unassigned' }
      return { key: id, label: name || 'Unassigned' }
    }
    default: {
      const raw = (lead as Record<string, unknown>)[fieldKey]
      if (raw == null || raw === '') return { key: 'unassigned', label: 'Unassigned' }
      return { key: String(raw), label: String(raw) }
    }
  }
}

// ── Tree Building ──

export function buildBreakdownTree(
  leads: LeadRow[],
  levels: BreakdownLevel[],
  valueMaps: Map<string, Map<string, string>>,
  segments: GoalSegment[],
  savedTargets: BreakdownTargets
): TreeNodeData[] {
  if (levels.length === 0) return []

  const level = levels[0]
  const isLeaf = levels.length === 1
  const nodeMap = new Map<string, TreeNodeData>()

  const valueMap = valueMaps.get(level.field)
  if (valueMap) {
    for (const [key, label] of valueMap.entries()) {
      nodeMap.set(key, {
        id: key, name: label, level: 0, fieldKey: level.field,
        wonRevenue: 0, pipelineValue: 0,
        target: getTargetFromNested(savedTargets, key),
        children: isLeaf ? [] : null, leadIds: [],
      })
    }
  }

  // Only add "Unassigned" for non-segment fields (segments always classify to fallback)
  const isSegmentLevel = level.field.startsWith('segment:')
  if (!isSegmentLevel && !nodeMap.has('unassigned')) {
    nodeMap.set('unassigned', {
      id: 'unassigned', name: 'Unassigned', level: 0, fieldKey: level.field,
      wonRevenue: 0, pipelineValue: 0,
      target: getTargetFromNested(savedTargets, 'unassigned'),
      children: isLeaf ? [] : null, leadIds: [],
    })
  }

  for (const lead of leads) {
    const resolved = resolveLeadValue(lead, level, segments)
    const key = resolved.key

    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key, name: resolved.label, level: 0, fieldKey: level.field,
        wonRevenue: 0, pipelineValue: 0,
        target: getTargetFromNested(savedTargets, key),
        children: isLeaf ? [] : null, leadIds: [],
      })
    }

    const node = nodeMap.get(key)!
    node.leadIds.push(lead.id)
    accumulateLeadValues(node, lead)
  }

  return Array.from(nodeMap.values()).sort((a, b) => b.wonRevenue - a.wonRevenue)
}

export function computeChildren(
  parentNode: TreeNodeData,
  allLeads: LeadRow[],
  levels: BreakdownLevel[],
  currentLevelIndex: number,
  valueMaps: Map<string, Map<string, string>>,
  segments: GoalSegment[],
  savedTargets: BreakdownTargets
): TreeNodeData[] {
  const nextLevelIndex = currentLevelIndex + 1
  if (nextLevelIndex >= levels.length) return []

  const nextLevel = levels[nextLevelIndex]
  const isLeaf = nextLevelIndex === levels.length - 1
  const parentLeadIds = new Set(parentNode.leadIds)
  const parentLeads = allLeads.filter((l) => parentLeadIds.has(l.id))

  const parentTargetObj = savedTargets?.[parentNode.id]
  const childTargets: BreakdownTargets =
    parentTargetObj && typeof parentTargetObj === 'object' && '_target' in parentTargetObj
      ? (parentTargetObj as BreakdownTargets)
      : {}

  const nodeMap = new Map<string, TreeNodeData>()
  const valueMap = valueMaps.get(nextLevel.field)
  if (valueMap) {
    for (const [key, label] of valueMap.entries()) {
      nodeMap.set(key, {
        id: key, name: label, level: nextLevelIndex, fieldKey: nextLevel.field,
        wonRevenue: 0, pipelineValue: 0,
        target: getTargetFromNested(childTargets, key),
        children: isLeaf ? [] : null, leadIds: [],
      })
    }
  }

  const isSegmentLevel = nextLevel.field.startsWith('segment:')
  if (!isSegmentLevel && !nodeMap.has('unassigned')) {
    nodeMap.set('unassigned', {
      id: 'unassigned', name: 'Unassigned', level: nextLevelIndex, fieldKey: nextLevel.field,
      wonRevenue: 0, pipelineValue: 0,
      target: getTargetFromNested(childTargets, 'unassigned'),
      children: isLeaf ? [] : null, leadIds: [],
    })
  }

  for (const lead of parentLeads) {
    const resolved = resolveLeadValue(lead, nextLevel, segments)
    const key = resolved.key

    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key, name: resolved.label, level: nextLevelIndex, fieldKey: nextLevel.field,
        wonRevenue: 0, pipelineValue: 0,
        target: getTargetFromNested(childTargets, key),
        children: isLeaf ? [] : null, leadIds: [],
      })
    }

    const node = nodeMap.get(key)!
    node.leadIds.push(lead.id)
    accumulateLeadValues(node, lead)
  }

  return Array.from(nodeMap.values()).sort((a, b) => b.wonRevenue - a.wonRevenue)
}

function accumulateLeadValues(node: TreeNodeData, lead: LeadRow) {
  const stage = lead.pipeline_stage
  const isWon = stage?.closed_status === 'won'
  const isLost = stage?.closed_status === 'lost'
  if (isWon) {
    // Fallback to estimated_value when actual_value is not yet filled
    node.wonRevenue += lead.actual_value ?? lead.estimated_value ?? 0
  } else if (!isLost) {
    node.pipelineValue += lead.estimated_value ?? 0
  }
}

function getTargetFromNested(targets: BreakdownTargets | undefined | null, key: string): number {
  if (!targets) return 0
  const entry = targets[key]
  if (entry == null) return 0
  return entry._target ?? 0
}

// ── Target Serialization ──

export function serializeTargets(nodes: TreeNodeData[]): BreakdownTargets {
  const result: BreakdownTargets = {}
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childObj = serializeTargets(node.children)
      result[node.id] = { _target: node.target, ...childObj } as BreakdownTargets[string]
    } else {
      result[node.id] = { _target: node.target } as BreakdownTargets[string]
    }
  }
  return result
}

export function deserializeTargets(
  targets: BreakdownTargets | undefined | null,
  path: string[]
): number {
  if (!targets || path.length === 0) return 0
  let current: unknown = targets
  for (const key of path) {
    if (current == null || typeof current !== 'object') return 0
    current = (current as Record<string, unknown>)[key]
    if (current == null) return 0
  }
  if (typeof current === 'number') return current
  if (typeof current === 'object' && current !== null && '_target' in current) {
    return (current as { _target: number })._target ?? 0
  }
  return 0
}

// ── Legacy Parsing ──

export function parseLegacyBreakdown(
  breakdownTargets: Record<string, unknown> | undefined | null
): { levels: string[]; targets: BreakdownTargets } {
  if (!breakdownTargets) return { levels: [], targets: {} }

  if (Array.isArray(breakdownTargets.levels) && breakdownTargets.levels.length > 0) {
    return {
      levels: breakdownTargets.levels as string[],
      targets: (breakdownTargets.targets as BreakdownTargets) ?? {},
    }
  }

  const breakdownField = breakdownTargets.breakdown_field as string | undefined
  if (!breakdownField) return { levels: [], targets: {} }

  const byKey = `by_${breakdownField}`
  const byMap = breakdownTargets[byKey] as Record<string, number> | undefined
  if (!byMap || typeof byMap !== 'object') return { levels: [breakdownField], targets: {} }

  const targets: BreakdownTargets = {}
  for (const [key, value] of Object.entries(byMap)) {
    if (typeof value === 'number') {
      targets[key] = { _target: value } as BreakdownTargets[string]
    }
  }

  return { levels: [breakdownField], targets }
}
