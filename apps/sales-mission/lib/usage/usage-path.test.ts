import { describe, expect, it } from "vitest"
import { isUsagePath, normalizeUsagePath, usagePageLabel, USAGE_PATH_MAX } from "./usage-path"

describe("normalizeUsagePath", () => {
  it("replaces a record's uuid with :id", () => {
    expect(normalizeUsagePath("/workspace/activities/8f3c2a10-4b5e-4c6d-9e7f-0a1b2c3d4e5f")).toBe("/workspace/activities/:id")
    expect(normalizeUsagePath("/workspace/activities/8F3C2A10-4B5E-4C6D-9E7F-0A1B2C3D4E5F/report")).toBe("/workspace/activities/:id/report")
  })

  it("replaces numeric and opaque token segments", () => {
    expect(normalizeUsagePath("/workspace/prospects/12345/edit")).toBe("/workspace/prospects/:id/edit")
    expect(normalizeUsagePath("/workspace/x/aB3dE5fG7hJ9kL1mN")).toBe("/workspace/x/:id")
  })

  it("keeps route words, even long ones", () => {
    expect(normalizeUsagePath("/workspace/settings/prospect-statuses")).toBe("/workspace/settings/prospect-statuses")
    expect(normalizeUsagePath("/workspace/kalender-saya")).toBe("/workspace/kalender-saya")
  })

  it("drops the query string and the fragment", () => {
    expect(normalizeUsagePath("/workspace/activities/8f3c2a10-4b5e-4c6d-9e7f-0a1b2c3d4e5f?fokus=laporan")).toBe("/workspace/activities/:id")
    expect(normalizeUsagePath("/workspace/panduan#laporan")).toBe("/workspace/panduan")
    expect(normalizeUsagePath("/workspace/reports?q=Arunika&status=SUBMITTED")).toBe("/workspace/reports")
  })

  it("drops trailing and doubled slashes", () => {
    expect(normalizeUsagePath("/workspace/")).toBe("/workspace")
    expect(normalizeUsagePath("//workspace//calendar/")).toBe("/workspace/calendar")
  })

  it("is idempotent, so the server can run it again", () => {
    const once = normalizeUsagePath("/workspace/activities/8f3c2a10-4b5e-4c6d-9e7f-0a1b2c3d4e5f/edit?x=1")
    expect(normalizeUsagePath(once)).toBe(once)
  })

  it("never grows past the column's limit", () => {
    const long = `/workspace/${"halaman/".repeat(40)}`
    expect(normalizeUsagePath(long).length).toBeLessThanOrEqual(USAGE_PATH_MAX)
  })
})

describe("isUsagePath", () => {
  it("accepts the workspace and what is under it", () => {
    expect(isUsagePath("/workspace")).toBe(true)
    expect(isUsagePath("/workspace/activities/:id")).toBe(true)
  })
  it("refuses anything else", () => {
    expect(isUsagePath("/workspaces")).toBe(false)
    expect(isUsagePath("/login")).toBe(false)
    expect(isUsagePath(`/workspace/${"a".repeat(USAGE_PATH_MAX)}`)).toBe(false)
  })
})

describe("usagePageLabel", () => {
  it("names the main places as the navigation does", () => {
    expect(usagePageLabel("/workspace")).toBe("Hari ini")
    expect(usagePageLabel("/workspace/activities")).toBe("Aktivitas")
    expect(usagePageLabel("/workspace/prospects")).toBe("Prospek")
    expect(usagePageLabel("/workspace/calendar")).toBe("Kalender")
    expect(usagePageLabel("/workspace/kalender-saya")).toBe("Kalender saya")
    expect(usagePageLabel("/workspace/board")).toBe("Papan live")
    expect(usagePageLabel("/workspace/notifications")).toBe("Notifikasi")
    expect(usagePageLabel("/workspace/panduan")).toBe("Panduan")
    expect(usagePageLabel("/workspace/yang-baru")).toBe("Yang baru")
  })

  it("names a record's pages by what they are", () => {
    expect(usagePageLabel("/workspace/activities/:id")).toBe("Detail aktivitas")
    expect(usagePageLabel("/workspace/activities/:id/report")).toBe("Laporan kunjungan")
    expect(usagePageLabel("/workspace/activities/:id/edit")).toBe("Ubah aktivitas")
    expect(usagePageLabel("/workspace/prospects/:id")).toBe("Detail prospek")
  })

  it("names Laporan's tabs", () => {
    expect(usagePageLabel("/workspace/reports")).toBe("Laporan · Daftar")
    expect(usagePageLabel("/workspace/reports/ringkasan")).toBe("Laporan · Ringkasan")
    expect(usagePageLabel("/workspace/reports/insight")).toBe("Laporan · Insight")
  })

  it("names Pengaturan's pages as their cards do", () => {
    expect(usagePageLabel("/workspace/settings")).toBe("Pengaturan")
    expect(usagePageLabel("/workspace/settings/history")).toBe("Pengaturan · Riwayat perubahan")
    expect(usagePageLabel("/workspace/settings/ai/pemakaian")).toBe("Pengaturan · Pemakaian AI")
    expect(usagePageLabel("/workspace/settings/usage")).toBe("Pengaturan · Pemakaian")
  })

  it("shows a page it does not know as its path", () => {
    expect(usagePageLabel("/workspace/halaman-baru")).toBe("/workspace/halaman-baru")
    expect(usagePageLabel("/workspace/settings/entah")).toBe("/workspace/settings/entah")
  })
})
