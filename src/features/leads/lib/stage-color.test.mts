import test from "node:test"
import assert from "node:assert/strict"

import { resolveStageColor, toRgba } from "./stage-color.ts"

test("resolveStageColor maps pipeline color tokens to hex values", () => {
    assert.equal(resolveStageColor("blue"), "#6366f1")
    assert.equal(resolveStageColor("emerald"), "#10b981")
    assert.equal(resolveStageColor("red"), "#ef4444")
})

test("resolveStageColor keeps valid hex colors", () => {
    assert.equal(resolveStageColor("#ABCDEF"), "#abcdef")
    assert.equal(resolveStageColor("#123"), "#112233")
})

test("toRgba converts resolved colors into rgba strings", () => {
    assert.equal(toRgba("sky", 0.72), "rgba(14, 165, 233, 0.72)")
})
