import { describe, it, expect } from "vitest"
import {
    getDescendantCompanyIds,
    getAncestorCompanyIds,
    getInvalidParentIds,
    getHierarchyDepth,
} from "../company-hierarchy"

// Tree:
//   B (top)
//   ├── A
//   │   └── A1
//   └── C
//   D (top, no children)
const tree = [
    { id: "B", parent_id: null },
    { id: "A", parent_id: "B" },
    { id: "A1", parent_id: "A" },
    { id: "C", parent_id: "B" },
    { id: "D", parent_id: null },
]

describe("getDescendantCompanyIds", () => {
    it("returns all descendants breadth-first, excluding root", () => {
        expect(getDescendantCompanyIds(tree, "B").sort()).toEqual(["A", "A1", "C"])
    })

    it("returns deeper descendants for a mid-level node", () => {
        expect(getDescendantCompanyIds(tree, "A")).toEqual(["A1"])
    })

    it("returns empty for a leaf node", () => {
        expect(getDescendantCompanyIds(tree, "A1")).toEqual([])
        expect(getDescendantCompanyIds(tree, "D")).toEqual([])
    })

    it("is cycle-safe (A → B → A does not infinite loop)", () => {
        const cyclic = [
            { id: "A", parent_id: "B" },
            { id: "B", parent_id: "A" },
        ]
        const r = getDescendantCompanyIds(cyclic, "A")
        expect(r).toContain("B")
        expect(r).not.toContain("A") // root never re-included
        expect(r.length).toBe(1)
    })
})

describe("getAncestorCompanyIds", () => {
    it("returns ancestors nearest-first", () => {
        expect(getAncestorCompanyIds(tree, "A1")).toEqual(["A", "B"])
    })

    it("returns single parent for a direct child", () => {
        expect(getAncestorCompanyIds(tree, "A")).toEqual(["B"])
    })

    it("returns empty for a top-level node", () => {
        expect(getAncestorCompanyIds(tree, "B")).toEqual([])
    })

    it("is cycle-safe", () => {
        const cyclic = [
            { id: "A", parent_id: "B" },
            { id: "B", parent_id: "A" },
        ]
        const r = getAncestorCompanyIds(cyclic, "A")
        expect(r).toEqual(["B"]) // stops once it loops back
    })
})

describe("getInvalidParentIds", () => {
    it("excludes the node itself and all its descendants", () => {
        const invalid = getInvalidParentIds(tree, "B")
        expect([...invalid].sort()).toEqual(["A", "A1", "B", "C"])
    })

    it("allows everything else for a leaf node (only itself invalid)", () => {
        expect([...getInvalidParentIds(tree, "A1")]).toEqual(["A1"])
    })

    it("returns empty set for a new company with no id", () => {
        expect(getInvalidParentIds(tree, null).size).toBe(0)
    })
})

describe("getHierarchyDepth", () => {
    it("is 0 for top-level", () => {
        expect(getHierarchyDepth(tree, "B")).toBe(0)
    })

    it("counts ancestors", () => {
        expect(getHierarchyDepth(tree, "A")).toBe(1)
        expect(getHierarchyDepth(tree, "A1")).toBe(2)
    })
})
