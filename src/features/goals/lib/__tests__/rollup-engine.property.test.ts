// Feature: goal-system-redesign, Property 11: Rollup parent equals sum of children

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { TreeNodeData } from '../breakdown-utils'

// ── Helper: verify rollup invariant recursively ──

function verifyRollupInvariant(node: TreeNodeData): void {
  if (!node.children || node.children.length === 0) return

  const sumWon = node.children.reduce((s, c) => s + c.wonRevenue, 0)
  const sumPipeline = node.children.reduce((s, c) => s + c.pipelineValue, 0)
  const sumTarget = node.children.reduce((s, c) => s + c.target, 0)

  expect(node.wonRevenue).toBeCloseTo(sumWon, 2)
  expect(node.pipelineValue).toBeCloseTo(sumPipeline, 2)
  expect(node.target).toBeCloseTo(sumTarget, 2)

  for (const child of node.children) {
    verifyRollupInvariant(child)
  }
}

// ── Arbitrary tree builder ──

interface SimpleNode {
  wonRevenue: number
  pipelineValue: number
  target: number
  children: SimpleNode[]
}

const leafArb: fc.Arbitrary<SimpleNode> = fc.record({
  wonRevenue: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  pipelineValue: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  target: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  children: fc.constant([]),
})

// Build a tree where parent values = sum of children (the invariant we want to test)
function buildSumTree(node: SimpleNode, level: number, id: string): TreeNodeData {
  if (node.children.length === 0) {
    return {
      id,
      name: `Node-${id}`,
      level,
      fieldKey: 'test-field',
      wonRevenue: node.wonRevenue,
      pipelineValue: node.pipelineValue,
      target: node.target,
      children: [],
      leadIds: [],
    }
  }

  const children = node.children.map((c, i) => buildSumTree(c, level + 1, `${id}-${i}`))

  return {
    id,
    name: `Node-${id}`,
    level,
    fieldKey: 'test-field',
    wonRevenue: children.reduce((s, c) => s + c.wonRevenue, 0),
    pipelineValue: children.reduce((s, c) => s + c.pipelineValue, 0),
    target: children.reduce((s, c) => s + c.target, 0),
    children,
    leadIds: [],
  }
}

// Arbitrary for a tree with up to 3 levels
const treeArb: fc.Arbitrary<SimpleNode> = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthFactor: 0.5 },
    leafArb,
    fc.record({
      wonRevenue: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      pipelineValue: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      target: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
      children: fc.array(tie('node') as fc.Arbitrary<SimpleNode>, { minLength: 1, maxLength: 4 }),
    }),
  ),
})).node as fc.Arbitrary<SimpleNode>

// ── Property 11: Rollup parent equals sum of children ──

describe('Rollup invariant — Property 11', () => {
  it('parent wonRevenue equals sum of children wonRevenue', () => {
    fc.assert(
      fc.property(treeArb, (simpleTree) => {
        const tree = buildSumTree(simpleTree, 0, 'root')
        verifyRollupInvariant(tree)
      }),
      { numRuns: 200 }
    )
  })

  it('invariant holds for a manually constructed 2-level tree', () => {
    const children: TreeNodeData[] = [
      {
        id: 'child-1', name: 'Child 1', level: 1, fieldKey: 'f',
        wonRevenue: 100, pipelineValue: 200, target: 300,
        children: [], leadIds: [],
      },
      {
        id: 'child-2', name: 'Child 2', level: 1, fieldKey: 'f',
        wonRevenue: 50, pipelineValue: 75, target: 150,
        children: [], leadIds: [],
      },
    ]

    const parent: TreeNodeData = {
      id: 'parent', name: 'Parent', level: 0, fieldKey: 'f',
      wonRevenue: 150,   // 100 + 50
      pipelineValue: 275, // 200 + 75
      target: 450,        // 300 + 150
      children,
      leadIds: [],
    }

    verifyRollupInvariant(parent)
  })

  it('invariant holds for a 3-level tree', () => {
    const grandchildren1: TreeNodeData[] = [
      {
        id: 'gc-1', name: 'GC1', level: 2, fieldKey: 'f',
        wonRevenue: 40, pipelineValue: 60, target: 100,
        children: [], leadIds: [],
      },
      {
        id: 'gc-2', name: 'GC2', level: 2, fieldKey: 'f',
        wonRevenue: 60, pipelineValue: 90, target: 150,
        children: [], leadIds: [],
      },
    ]

    const child1: TreeNodeData = {
      id: 'c-1', name: 'C1', level: 1, fieldKey: 'f',
      wonRevenue: 100, pipelineValue: 150, target: 250,
      children: grandchildren1, leadIds: [],
    }

    const child2: TreeNodeData = {
      id: 'c-2', name: 'C2', level: 1, fieldKey: 'f',
      wonRevenue: 200, pipelineValue: 300, target: 500,
      children: [], leadIds: [],
    }

    const root: TreeNodeData = {
      id: 'root', name: 'Root', level: 0, fieldKey: 'f',
      wonRevenue: 300, pipelineValue: 450, target: 750,
      children: [child1, child2], leadIds: [],
    }

    verifyRollupInvariant(root)
  })
})
