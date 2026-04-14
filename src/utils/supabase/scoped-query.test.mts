import test from "node:test"
import assert from "node:assert/strict"

import { getScopedCompanyId } from "./scoped-query.ts"

test("getScopedCompanyId returns null for holding view", () => {
    assert.equal(
        getScopedCompanyId({ id: "holding-company", isHolding: true }),
        null
    )
})

test("getScopedCompanyId returns active company id for subsidiary view", () => {
    assert.equal(
        getScopedCompanyId({ id: "subsidiary-1", isHolding: false }),
        "subsidiary-1"
    )
})

test("getScopedCompanyId returns null when no company context exists", () => {
    assert.equal(getScopedCompanyId(null), null)
})
