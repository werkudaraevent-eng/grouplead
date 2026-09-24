import { describe, expect, it } from "vitest"
import { sentenceCaseLabel } from "../label-case"

describe("sentenceCaseLabel", () => {
    it("lowers every Title Case word after the first", () => {
        expect(sentenceCaseLabel("Segment Tier")).toBe("Segment tier")
        expect(sentenceCaseLabel("Line Of Industry")).toBe("Line of industry")
    })

    it("leaves a one-word label as it is", () => {
        expect(sentenceCaseLabel("Account")).toBe("Account")
        expect(sentenceCaseLabel("Segment")).toBe("Segment")
    })

    it("capitalises the first word", () => {
        expect(sentenceCaseLabel("segment tier")).toBe("Segment tier")
    })

    it("keeps acronyms, mixed-case names and single letters", () => {
        expect(sentenceCaseLabel("PIC Sales")).toBe("PIC sales")
        expect(sentenceCaseLabel("MICE Segment")).toBe("MICE segment")
        expect(sentenceCaseLabel("WhatsApp Number")).toBe("WhatsApp number")
        expect(sentenceCaseLabel("Plan A Budget")).toBe("Plan A budget")
    })

    it("treats words around punctuation as words", () => {
        expect(sentenceCaseLabel("Industry / Sub Sector")).toBe("Industry / sub sector")
        expect(sentenceCaseLabel("No. Of Pax (Estimated)")).toBe("No. of pax (estimated)")
    })

    it("trims and passes an empty label through", () => {
        expect(sentenceCaseLabel("  Segment Tier  ")).toBe("Segment tier")
        expect(sentenceCaseLabel("")).toBe("")
    })
})
