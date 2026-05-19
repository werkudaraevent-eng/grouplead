import { describe, it, expect } from "vitest"
import { mergeMissingNativeFields } from "../layout-self-heal"

describe("mergeMissingNativeFields", () => {
    it("injects newly-added native fields into existing tabs", () => {
        const saved = {
            project: ["native:project_name", "native:pipeline_stage_id"],
            hidden: [],
        }
        const defaults = {
            project: [
                "native:project_name",
                "native:pipeline_stage_id",
                "native:received_date", // newly added native field
                "native:target_close_date",
            ],
            hidden: [],
        }

        const result = mergeMissingNativeFields(saved, defaults)

        expect(result.project).toEqual([
            "native:project_name",
            "native:pipeline_stage_id",
            "native:received_date",
            "native:target_close_date",
        ])
    })

    it("keeps user-added custom field positions", () => {
        const saved = {
            project: ["native:project_name", "custom:lead_ref", "native:pipeline_stage_id"],
        }
        const defaults = {
            project: [
                "native:project_name",
                "native:pipeline_stage_id",
                "native:received_date",
            ],
        }

        const result = mergeMissingNativeFields(saved, defaults)

        // custom:lead_ref position is preserved; received_date is appended
        // after its anchor (pipeline_stage_id, the previous default sibling).
        expect(result.project).toEqual([
            "native:project_name",
            "custom:lead_ref",
            "native:pipeline_stage_id",
            "native:received_date",
        ])
    })

    it("anchors to the next sibling when the previous one is absent", () => {
        const saved = {
            project: ["native:target_close_date"],
        }
        const defaults = {
            project: [
                "native:project_name",
                "native:received_date",
                "native:target_close_date",
            ],
        }

        const result = mergeMissingNativeFields(saved, defaults)

        // received_date's previous sibling (project_name) is missing, so it
        // falls through to the next sibling (target_close_date) and is
        // inserted before it. project_name itself is healed at the start.
        expect(result.project).toEqual([
            "native:project_name",
            "native:received_date",
            "native:target_close_date",
        ])
    })

    it("never restores fields the user moved to Hidden", () => {
        const saved = {
            project: ["native:project_name"],
            hidden: ["native:referral_source"], // user intentionally hid this
        }
        const defaults = {
            project: ["native:project_name", "native:referral_source"],
            hidden: [],
        }

        const result = mergeMissingNativeFields(saved, defaults)

        // referral_source already exists (in hidden), so the helper should
        // NOT duplicate it into project.
        expect(result.project).toEqual(["native:project_name"])
        expect(result.hidden).toEqual(["native:referral_source"])
    })

    it("ignores custom: fields in defaults", () => {
        const saved = {
            project: ["native:project_name"],
        }
        const defaults = {
            project: ["native:project_name", "custom:legacy"],
        }

        const result = mergeMissingNativeFields(saved, defaults)

        // custom: fields are tenant-specific; we only auto-restore native: ones.
        expect(result.project).toEqual(["native:project_name"])
    })

    it("creates the tab array when missing", () => {
        const saved = {
            project: ["native:project_name"],
        }
        const defaults = {
            project: ["native:project_name"],
            event: ["native:event_dates"],
        }

        const result = mergeMissingNativeFields(saved, defaults)

        expect(result.event).toEqual(["native:event_dates"])
    })

    it("does not mutate input", () => {
        const saved = {
            project: ["native:project_name"],
        }
        const defaults = {
            project: ["native:project_name", "native:received_date"],
        }
        const savedSnapshot = JSON.stringify(saved)

        mergeMissingNativeFields(saved, defaults)

        expect(JSON.stringify(saved)).toBe(savedSnapshot)
    })
})
