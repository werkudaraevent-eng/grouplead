// Feature: goal-system-redesign, Property 1: Breakdown targets serialization round-trip
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { serializeTargets, deserializeTargets } from '../breakdown-utils'
import type { TreeNodeData } from '../breakdown-utils'

// Arbitrary for a flat tree node (no children)
const leafNodeArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== '_target'),
  name: fc.string({ minLength: 1 }),
  level: fc.nat(9),
  fieldKey: fc.string({ minLength: 1 }),
  wonRevenue: fc.double({ min: 0, max: 1e12, noNaN: true }),
  pipelineValue: fc.double({ min: 0, max: 1e12, noNaN: true }),
  target: fc.double({ min: 0, max: 1e12, noNaN: true }),
  children: fc.constant([] as TreeNodeData[]),
  leadIds: fc.array(fc.nat()),
})

// Arbitrary for a 2-level tree (parent with leaf children)
const twoLevelTreeArb = fc
  .array(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== '_target'),
      name: fc.string({ minLength: 1 }),
      level: fc.constant(0),
      fieldKey: fc.constant('field_a'),
      wonRevenue: fc.double({ min: 0, max: 1e12, noNaN: true }),
      pipelineValue: fc.double({ min: 0, max: 1e12, noNaN: true }),
      target: fc.double({ min: 0, max: 1e12, noNaN: true }),
      leadIds: fc.array(fc.nat()),
      children: fc.array(leafNodeArb, { minLength: 0, maxLength: 5 }),
    }),
    { minLength: 1, maxLength: 10 }
  )
  // Ensure unique IDs at each level
  .filter((nodes) => new Set(nodes.map((n) => n.id)).size === nodes.length)

describe('Property 1: Breakdown targets serialization round-trip', () => {
  it('serializeTargets → deserializeTargets returns original target for leaf nodes', () => {
    fc.assert(
      fc.property(fc.array(leafNodeArb, { minLength: 1, maxLength: 20 }), (nodes) => {
        // Ensure unique IDs
        const uniqueNodes = nodes.filter(
          (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i
        )
        if (uniqueNodes.length === 0) return

        const serialized = serializeTargets(uniqueNodes)

        for (const node of uniqueNodes) {
          const recovered = deserializeTargets(serialized, [node.id])
          expect(recovered).toBeCloseTo(node.target, 5)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('serializeTargets → deserializeTargets returns original target for 2-level trees', () => {
    fc.assert(
      fc.property(twoLevelTreeArb, (nodes) => {
        const serialized = serializeTargets(nodes)

        for (const parent of nodes) {
          // Parent target
          const parentTarget = deserializeTargets(serialized, [parent.id])
          expect(parentTarget).toBeCloseTo(parent.target, 5)

          // Child targets
          const uniqueChildren = parent.children.filter(
            (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
          )
          for (const child of uniqueChildren) {
            const childTarget = deserializeTargets(serialized, [parent.id, child.id])
            expect(childTarget).toBeCloseTo(child.target, 5)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it('deserializeTargets returns 0 for missing paths', () => {
    fc.assert(
      fc.property(
        fc.array(leafNodeArb, { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1 }),
        (nodes, missingKey) => {
          const uniqueNodes = nodes.filter(
            (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i
          )
          const serialized = serializeTargets(uniqueNodes)
          // A key that doesn't exist in the tree
          if (uniqueNodes.some((n) => n.id === missingKey)) return
          expect(deserializeTargets(serialized, [missingKey])).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
