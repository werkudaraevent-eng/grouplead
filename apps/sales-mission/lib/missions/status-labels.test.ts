import { describe, expect, it } from "vitest"
import { MISSION_STATUSES, ASSIGNMENT_RESPONSES } from "./mission-schema"
import { REPORT_STATUSES } from "./visit-report-schema"
import { STATUS_LABELS, statusLabel } from "./status-labels"

describe("STATUS_LABELS", () => {
  // A status added to an enum without a label here would silently fall back to
  // the raw database value, which is the defect this map exists to remove.
  it("covers every mission status", () => {
    for (const status of MISSION_STATUSES) {
      expect(STATUS_LABELS[status], status).toBeTruthy()
    }
  })

  it("covers every assignment response", () => {
    for (const response of ASSIGNMENT_RESPONSES) {
      expect(STATUS_LABELS[response], response).toBeTruthy()
    }
  })

  it("covers every report status", () => {
    for (const status of REPORT_STATUSES) {
      expect(STATUS_LABELS[status], status).toBeTruthy()
    }
  })

  it("never leaks an underscore or an all-caps enum to the screen", () => {
    for (const label of Object.values(STATUS_LABELS)) {
      expect(label).not.toMatch(/_/)
      expect(label).not.toBe(label.toUpperCase())
    }
  })

  it("gives the shared keys one meaning across the three enums", () => {
    // ACCEPTED, REJECTED and RESCHEDULE_REQUESTED belong to both the mission
    // lifecycle and the assignment response; DRAFT to both mission and report.
    expect(STATUS_LABELS.ACCEPTED).toBe("Diterima")
    expect(STATUS_LABELS.DRAFT).toBe("Draf")
  })
})

describe("statusLabel", () => {
  it("returns the mapped label", () => {
    expect(statusLabel("NEEDS_CLARIFICATION")).toBe("Perlu klarifikasi")
  })

  it("degrades an unknown status to a readable form rather than throwing", () => {
    expect(statusLabel("SOMETHING_NEW")).toBe("SOMETHING NEW")
  })
})
