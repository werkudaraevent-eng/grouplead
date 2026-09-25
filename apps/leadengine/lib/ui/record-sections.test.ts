import { describe, expect, it } from "vitest"
import { pickActiveSection, sectionScrollTop, spyRootMargin, SECTION_GAP_PX } from "./record-sections"

describe("sectionScrollTop", () => {
    it("puts the section's top the gap below the pinned bars", () => {
        // Scroller at 120 from the viewport top, scrolled 300; section 900 down the viewport.
        const top = sectionScrollTop({ scrollTop: 300, sectionTop: 900, scrollerTop: 120, pinned: 105 })
        expect(top).toBe(300 + (900 - 120) - 105 - SECTION_GAP_PX)
    })

    it("scrolls back up to a section above the view", () => {
        expect(sectionScrollTop({ scrollTop: 1200, sectionTop: -400, scrollerTop: 56, pinned: 49, gap: 16 })).toBe(1200 - 456 - 65)
    })

    it("never asks for less than 0", () => {
        expect(sectionScrollTop({ scrollTop: 0, sectionTop: 150, scrollerTop: 56, pinned: 105 })).toBe(0)
    })

    it("never asks for more than the scroller can reach", () => {
        expect(sectionScrollTop({ scrollTop: 0, sectionTop: 3000, scrollerTop: 0, pinned: 0, maxScrollTop: 1800 })).toBe(1800)
        expect(sectionScrollTop({ scrollTop: 0, sectionTop: 3000, scrollerTop: 0, pinned: 0, maxScrollTop: -5 })).toBe(0)
    })
})

describe("spyRootMargin", () => {
    it("watches a band from under the pinned bars to 40% of the height", () => {
        expect(spyRootMargin(105, 800)).toBe("-121px 0px -480px 0px")
    })

    it("keeps the band at least 1px tall in a short window", () => {
        expect(spyRootMargin(200, 300)).toBe("-216px 0px -83px 0px")
    })

    it("never gives a negative bottom margin", () => {
        expect(spyRootMargin(400, 300)).toBe("-416px 0px 0px 0px")
    })
})

describe("pickActiveSection", () => {
    const order = ["info", "notes", "leads", "files"]

    it("takes the first section in page order that crosses the band", () => {
        expect(pickActiveSection(order, new Set(["leads", "notes"]), false)).toBe("notes")
    })

    it("takes the last section at the end of the page", () => {
        expect(pickActiveSection(order, new Set(["leads"]), true)).toBe("files")
    })

    it("says nothing when the band sits between two sections", () => {
        expect(pickActiveSection(order, new Set(), false)).toBeNull()
        expect(pickActiveSection([], new Set(), true)).toBeNull()
    })
})
