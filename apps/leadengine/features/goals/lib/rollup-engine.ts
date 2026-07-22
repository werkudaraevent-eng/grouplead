import type { BreakdownLevelConfig, BreakdownTargets, GoalSegment } from '@/types/goals'
import {
  buildBreakdownTree,
  computeChildren,
  setDimensionSourceFields,
  type TreeNodeData,
  type LeadRow,
} from './breakdown-utils'

/**
 * Builds a full breakdown tree from GoalV2's breakdown_config JSONB.
 * Replaces the old rollUpHierarchy() which worked with TemplateNode[].
 *
 * Ensures parent node values equal the sum of their children's values.
 */
export function rollUpFromBreakdownConfig(
  leads: LeadRow[],
  breakdownConfig: BreakdownLevelConfig[],
  segments: GoalSegment[],
  breakdownTargets: BreakdownTargets,
  valueMaps: Map<string, Map<string, string>>
): TreeNodeData {
  if (breakdownConfig.length === 0) {
    return {
      id: 'root',
      name: 'Total',
      level: -1,
      fieldKey: '',
      wonRevenue: leads.reduce((sum, l) => {
        const isWon = l.pipeline_stage?.closed_status === 'won'
        return sum + (isWon ? (l.actual_value ?? 0) : 0)
      }, 0),
      pipelineValue: leads.reduce((sum, l) => {
        const isLost = l.pipeline_stage?.closed_status === 'lost'
        const isWon = l.pipeline_stage?.closed_status === 'won'
        return sum + (!isWon && !isLost ? (l.estimated_value ?? 0) : 0)
      }, 0),
      target: (breakdownTargets as any)._target ?? 0,
      children: [],
      leadIds: leads.map((l) => l.id),
    }
  }

  // Build segment source field map for dimension resolution
  const dimensionSourceFields = new Map<string, string>()
  for (const segment of segments) {
    dimensionSourceFields.set(segment.id, segment.source_field)
  }
  setDimensionSourceFields(dimensionSourceFields)

  // Convert BreakdownLevelConfig[] to BreakdownLevel[] format (field/label)
  const levels = breakdownConfig

  // Build top-level nodes
  const topNodes = buildBreakdownTree(
    leads,
    levels,
    valueMaps,
    segments,
    breakdownTargets
  )

  // Recursively compute children for all nodes
  function populateChildren(nodes: TreeNodeData[], levelIndex: number): TreeNodeData[] {
    if (levelIndex >= levels.length - 1) return nodes

    return nodes.map((node) => {
      const children = computeChildren(
        node,
        leads,
        levels,
        levelIndex,
        valueMaps,
        segments,
        breakdownTargets
      )
      const populatedChildren = populateChildren(children, levelIndex + 1)

      // Ensure parent values equal sum of children
      const wonRevenue = populatedChildren.reduce((sum, c) => sum + c.wonRevenue, 0)
      const pipelineValue = populatedChildren.reduce((sum, c) => sum + c.pipelineValue, 0)

      return {
        ...node,
        wonRevenue,
        pipelineValue,
        children: populatedChildren,
      }
    })
  }

  const populatedNodes = populateChildren(topNodes, 0)

  // Wrap in synthetic root
  const totalWon = populatedNodes.reduce((sum, n) => sum + n.wonRevenue, 0)
  const totalPipeline = populatedNodes.reduce((sum, n) => sum + n.pipelineValue, 0)
  const totalTarget = populatedNodes.reduce((sum, n) => sum + n.target, 0)

  return {
    id: 'root',
    name: 'Total',
    level: -1,
    fieldKey: '',
    wonRevenue: totalWon,
    pipelineValue: totalPipeline,
    target: totalTarget,
    children: populatedNodes,
    leadIds: leads.map((l) => l.id),
  }
}
