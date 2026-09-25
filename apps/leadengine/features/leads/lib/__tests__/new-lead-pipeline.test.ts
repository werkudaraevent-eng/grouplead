import { describe, expect, it } from "vitest"
import { pickPipelineId } from "../new-lead-pipeline"

describe("pickPipelineId", () => {
    const pipelines = [{ id: "p1" }, { id: "p2" }]

    it("uses the pipeline the person last had open while it is active", () => {
        expect(pickPipelineId(pipelines, "p2")).toBe("p2")
    })

    it("falls back to the first active pipeline", () => {
        expect(pickPipelineId(pipelines, "gone")).toBe("p1")
        expect(pickPipelineId(pipelines, null)).toBe("p1")
    })

    it("has nothing without pipelines", () => {
        expect(pickPipelineId([], "p1")).toBeNull()
    })
})
