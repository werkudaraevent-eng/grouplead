// A breakdown value is any string from lead data, so a node id can be "__proto__"
// (fast-check found this one; assignment on a plain object had swallowed it).
import { it, expect } from 'vitest'
import { serializeTargets, deserializeTargets } from '../breakdown-utils'

it('round-trips a child whose id is __proto__', () => {
  const nodes = [
    {
      id: ' ', name: ' ', level: 0, fieldKey: 'field_a', wonRevenue: 0, pipelineValue: 0, target: 0, leadIds: [],
      children: [{ id: '__proto__', name: ' ', level: 0, fieldKey: ' ', wonRevenue: 0, pipelineValue: 0, target: 0.0000049999999999999996, children: [], leadIds: [] }],
    },
    { id: '!', name: ' ', level: 0, fieldKey: 'field_a', wonRevenue: 0, pipelineValue: 0, target: 0, leadIds: [], children: [] },
  ]
  const serialized = serializeTargets(nodes as never)
  expect(deserializeTargets(serialized, [' ', '__proto__'])).toBeCloseTo(0.0000049999999999999996, 5)
  // And through the JSON the database stores it as.
  expect(deserializeTargets(JSON.parse(JSON.stringify(serialized)), [' ', '__proto__'])).toBeCloseTo(0.0000049999999999999996, 5)
  // Keys that exist on Object.prototype but not in the data are not targets.
  expect(deserializeTargets(serialized, [' ', 'constructor'])).toBe(0)
  expect(deserializeTargets(serialized, ['toString'])).toBe(0)
})
