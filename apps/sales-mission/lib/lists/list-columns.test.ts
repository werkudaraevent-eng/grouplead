import { describe, expect, it } from "vitest"
import {
  columnStateKey,
  defaultColumnState,
  mergeColumnState,
  moveColumn,
  sameColumnState,
  shownCount,
  tableMinWidth,
  toggleColumn,
  visibleColumns,
  type ColumnSpec,
} from "./list-columns"
import { ACTION_COLUMN_WIDTHS, ACTIVITY_COLUMNS, PROSPECT_COLUMNS, REPORT_COLUMNS } from "./list-column-specs"

const SPECS: ColumnSpec[] = [
  { id: "name", label: "Nama", width: 200, locked: true },
  { id: "a", label: "A", width: 100, defaultVisible: true },
  { id: "b", label: "B", width: 120 },
  { id: "c", label: "C", width: 140, defaultVisible: true },
]

describe("defaultColumnState", () => {
  it("lists the optional columns in spec order at their default visibility, never the locked one", () => {
    expect(defaultColumnState(SPECS)).toEqual([
      { id: "a", visible: true },
      { id: "b", visible: false },
      { id: "c", visible: true },
    ])
  })
})

describe("mergeColumnState", () => {
  it("falls back to the defaults for anything that is not a list", () => {
    expect(mergeColumnState(SPECS, undefined)).toEqual(defaultColumnState(SPECS))
    expect(mergeColumnState(SPECS, "a,b")).toEqual(defaultColumnState(SPECS))
    expect(mergeColumnState(SPECS, { a: true })).toEqual(defaultColumnState(SPECS))
  })

  it("keeps the stored order and visibility", () => {
    const stored = [
      { id: "c", visible: false },
      { id: "b", visible: true },
      { id: "a", visible: true },
    ]
    expect(mergeColumnState(SPECS, stored)).toEqual(stored)
  })

  it("drops unknown ids, the locked column and duplicates, and appends columns added since", () => {
    const stored = [{ id: "gone", visible: true }, { id: "name", visible: false }, { id: "c", visible: false }, { id: "c", visible: true }, null, 7]
    expect(mergeColumnState(SPECS, stored)).toEqual([
      { id: "c", visible: false },
      { id: "a", visible: true },
      { id: "b", visible: false },
    ])
  })

  it("reads a missing visible flag as shown", () => {
    expect(mergeColumnState(SPECS, [{ id: "b" }])[0]).toEqual({ id: "b", visible: true })
  })
})

describe("visibleColumns", () => {
  it("draws the locked column first, then the shown ones in their order", () => {
    const state = [
      { id: "c", visible: true },
      { id: "a", visible: false },
      { id: "b", visible: true },
    ]
    expect(visibleColumns(SPECS, state).map((column) => column.id)).toEqual(["name", "c", "b"])
  })

  it("never draws a locked column twice or an unknown id", () => {
    expect(visibleColumns(SPECS, [{ id: "name", visible: true }, { id: "zzz", visible: true }]).map((column) => column.id)).toEqual(["name"])
  })
})

describe("toggling, moving, counting", () => {
  it("toggles one column", () => {
    expect(toggleColumn(defaultColumnState(SPECS), "b", true)).toEqual([
      { id: "a", visible: true },
      { id: "b", visible: true },
      { id: "c", visible: true },
    ])
  })

  it("moves a column and ignores moves out of range", () => {
    const state = defaultColumnState(SPECS)
    expect(moveColumn(state, 2, 0).map((column) => column.id)).toEqual(["c", "a", "b"])
    expect(moveColumn(state, 0, 2).map((column) => column.id)).toEqual(["b", "c", "a"])
    expect(moveColumn(state, 0, 3)).toEqual(state)
    expect(moveColumn(state, -1, 0)).toEqual(state)
  })

  it("says N of M with the locked column counted as shown", () => {
    expect(shownCount(SPECS, defaultColumnState(SPECS))).toEqual({ shown: 3, total: 4 })
  })

  it("compares by order and visibility", () => {
    const state = defaultColumnState(SPECS)
    expect(columnStateKey(state)).toBe("a,b-,c")
    expect(sameColumnState(state, [...state])).toBe(true)
    expect(sameColumnState(state, moveColumn(state, 0, 1))).toBe(false)
    expect(sameColumnState(state, toggleColumn(state, "a", false))).toBe(false)
  })

  it("sums the widths the table needs before it scrolls", () => {
    expect(tableMinWidth(visibleColumns(SPECS, defaultColumnState(SPECS)), 44)).toBe(44 + 200 + 100 + 140)
  })
})

describe("the three lists' columns", () => {
  // 1280 minus the 220px drawer, the page's 2 × 32px gutters, the card's
  // border and the table's own vertical scrollbar (10px when thin): the
  // page no longer scrolls, the card does.
  const LAPTOP = 1280 - 220 - 64 - 2 - 10
  // 1366 is the next laptop up; there the widest buttons fit too.
  const WIDER_LAPTOP = LAPTOP + 86
  const SELECT = 44

  for (const [name, specs, action] of [
    ["Aktivitas", ACTIVITY_COLUMNS, ACTION_COLUMN_WIDTHS.activities],
    ["Prospek", PROSPECT_COLUMNS, ACTION_COLUMN_WIDTHS.prospects],
    ["Laporan", REPORT_COLUMNS, null],
  ] as const) {
    const defaults = visibleColumns([...specs], defaultColumnState([...specs]))
    const select = action ? SELECT : 0

    it(`${name} has one locked name column first and unique ids`, () => {
      expect(specs.filter((spec) => spec.locked)).toHaveLength(1)
      expect(specs[0].locked).toBe(true)
      expect(new Set(specs.map((spec) => spec.id)).size).toBe(specs.length)
    })

    it(`${name}'s default columns fit a 1280px laptop with the drawer open, with the buttons most rows carry`, () => {
      expect(tableMinWidth(defaults, select + (action?.usual ?? 0))).toBeLessThanOrEqual(LAPTOP)
    })

    it(`${name}'s default columns fit a 1366px laptop with the drawer open, whatever button a row carries`, () => {
      expect(tableMinWidth(defaults, select + (action?.widest ?? 0))).toBeLessThanOrEqual(WIDER_LAPTOP)
    })
  }

  it("orders each list's action widths: the usual button is never wider than the widest", () => {
    for (const widths of Object.values(ACTION_COLUMN_WIDTHS)) expect(widths.usual).toBeLessThanOrEqual(widths.widest)
  })
})
