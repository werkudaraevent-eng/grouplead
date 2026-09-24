import { describe, expect, it } from "vitest"
import { edgeFadeState } from "./edge-fade"

describe("edgeFadeState", () => {
    it("fades nothing when everything fits", () => {
        expect(edgeFadeState({ scrollLeft: 0, scrollWidth: 390, clientWidth: 390 })).toEqual({ left: false, right: false })
        expect(edgeFadeState({ scrollLeft: 0, scrollWidth: 200, clientWidth: 390 })).toEqual({ left: false, right: false })
    })

    it("treats a sub-pixel overflow as fitting", () => {
        expect(edgeFadeState({ scrollLeft: 0, scrollWidth: 390.6, clientWidth: 390 })).toEqual({ left: false, right: false })
    })

    it("fades only the right edge at the start of a row that overflows", () => {
        expect(edgeFadeState({ scrollLeft: 0, scrollWidth: 900, clientWidth: 390 })).toEqual({ left: false, right: true })
    })

    it("fades both edges in the middle", () => {
        expect(edgeFadeState({ scrollLeft: 200, scrollWidth: 900, clientWidth: 390 })).toEqual({ left: true, right: true })
    })

    it("fades only the left edge at the end", () => {
        expect(edgeFadeState({ scrollLeft: 510, scrollWidth: 900, clientWidth: 390 })).toEqual({ left: true, right: false })
    })

    it("ignores a sub-pixel offset at either end", () => {
        expect(edgeFadeState({ scrollLeft: 0.5, scrollWidth: 900, clientWidth: 390 })).toEqual({ left: false, right: true })
        expect(edgeFadeState({ scrollLeft: 509.5, scrollWidth: 900, clientWidth: 390 })).toEqual({ left: true, right: false })
    })
})
