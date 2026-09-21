import { describe, expect, it } from "vitest"
import { DEFAULT_REPORT_SHARE_TEMPLATE, SAMPLE_REPORT_SHARE_VALUES, renderReportShare } from "./report-share"

describe("renderReportShare", () => {
  it("renders the default template in the group's format and asks for the photo", () => {
    const share = renderReportShare(null, SAMPLE_REPORT_SHARE_VALUES)
    expect(share.withPhoto).toBe(true)
    expect(share.text).toBe(
      [
        "WSM | 21 Sep 2026 | 11.00",
        "Company : Prime Travelindo",
        "Nama PIC : Pak Budi",
        "Jabatan : Operations Manager",
        "",
        "Prime Travelindo saat ini fokus ke ticketing pesawat; permintaan LA dilempar ke rekanan. Sedang menangani outing 400-an pax ke Belitung.",
      ].join("\n")
    )
  })

  it("drops a line whose placeholders are all empty, keeps a line that still says something", () => {
    const share = renderReportShare("Klien: {klien}\nJabatan : {jabatan}\nHasil {hasil} · {minat}\nCatatan tetap", {
      ...SAMPLE_REPORT_SHARE_VALUES,
      jabatan: "",
      hasil: "",
    })
    expect(share.text).toBe("Klien: Prime Travelindo\nHasil  · Hangat\nCatatan tetap")
    expect(share.withPhoto).toBe(false)
  })

  it("leaves a placeholder it does not know as typed and collapses blank runs", () => {
    const share = renderReportShare("{klien}\n\n\n\n{misterius}\n{ringkasan}", SAMPLE_REPORT_SHARE_VALUES)
    expect(share.text.startsWith("Prime Travelindo\n\n{misterius}\n")).toBe(true)
  })

  it("uses the default when the template is blank", () => {
    expect(renderReportShare("   ", SAMPLE_REPORT_SHARE_VALUES).text).toBe(renderReportShare(DEFAULT_REPORT_SHARE_TEMPLATE, SAMPLE_REPORT_SHARE_VALUES).text)
  })
})
