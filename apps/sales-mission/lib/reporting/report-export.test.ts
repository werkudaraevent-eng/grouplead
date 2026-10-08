import { describe, expect, it } from "vitest"
import { audioDownloadName } from "@/lib/audio/audio-answer"
import { CORE_REPORT_FIELDS, type FieldType, type FormField } from "@/lib/missions/form-fields"
import { defaultChoiceSet } from "@/lib/missions/report-choices"
import {
  attachmentColumnCount,
  attachmentHeaders,
  buildReportExport,
  csvRows,
  wibDay,
  wibTime,
  type ExportContact,
  type ReportExportOptions,
  type ReportExportRow,
} from "./report-export"

const CHOICES = defaultChoiceSet()

const COMPANY = "11111111-1111-4111-8111-111111111111"
const PHOTO_PATH = `${COMPANY}/report/22222222-2222-4222-8222-222222222222.jpg`
const PHOTO_PATH_2 = `${COMPANY}/report/22222222-2222-4222-8222-222222222223.jpg`
const PHOTO_PATH_3 = `${COMPANY}/report/22222222-2222-4222-8222-222222222224.png`
const AUDIO_PATH = `${COMPANY}/report/33333333-3333-4333-8333-333333333333.m4a`

function field(overrides: Partial<FormField> & { reportingKey: string; label: string }): FormField {
  return {
    id: `field-${overrides.reportingKey}`,
    fieldType: "TEXT" as FieldType,
    isRequired: false,
    isCore: false,
    isActive: true,
    placeholder: null,
    helpText: null,
    options: [],
    displayOrder: 10,
    allowOther: false,
    ...overrides,
  }
}

/** The tenant's report form as it is seeded: every core field, in its order. */
function coreFields(): FormField[] {
  return CORE_REPORT_FIELDS.map((core) =>
    field({
      reportingKey: core.reportingKey,
      label: core.label,
      fieldType: core.fieldType,
      isCore: true,
      displayOrder: core.displayOrder,
      options: core.options ?? [],
    })
  )
}

function contact(overrides: Partial<ExportContact> & { fullName: string }): ExportContact {
  return {
    jobTitle: null,
    phone: null,
    email: null,
    isDecisionMaker: false,
    discPrimary: null,
    discSecondary: null,
    discNote: null,
    discAssessedByName: null,
    discAssessedAt: null,
    ...overrides,
  }
}

function row(overrides: Partial<ReportExportRow> = {}): ReportExportRow {
  return {
    reportId: "report-1",
    missionId: "mission-1",
    clientCompanyName: "PT Arunika Kreasi",
    missionType: "Meeting",
    scheduledStart: "2026-09-15T02:30:00.000Z",
    scheduledEnd: "2026-09-15T04:00:00.000Z",
    actualStart: "2026-09-15T02:45:00.000Z",
    actualEnd: "2026-09-15T04:10:00.000Z",
    location: "Jakarta Selatan",
    address: "Jl. Jend. Sudirman Kav. 52-53",
    industry: "Teknologi",
    objective: "Presentasi awal",
    primarySalesName: "Yulia",
    supportingSalesNames: ["Budi", "Sari"],
    status: "SUBMITTED",
    visitOutcome: "MET_DECISION_MAKER",
    meetingSummary: "Klien minta rundown.",
    clientNeeds: ["Corporate gathering", "Katering"],
    productInterest: [],
    interestLevel: "WARM",
    opportunityExists: true,
    estimatedValue: 15000000,
    competitorMentioned: "PT Lain",
    nextActionType: "SEND_PROPOSAL",
    nextActionOwnerName: "Yulia",
    followUpDate: "2026-09-20",
    custom: {},
    contacts: [],
    clarificationNote: null,
    supportingNotes: [],
    pushedLeadId: null,
    pushedCategory: null,
    followUp: null,
    submittedByName: "Yulia",
    submittedAt: "2026-09-15T10:05:00.000Z",
    ...overrides,
  }
}

const OPTIONS: ReportExportOptions = { origin: "https://mission.example" }

function build(rows: ReportExportRow[], fields: FormField[] = coreFields(), options: ReportExportOptions = OPTIONS) {
  return buildReportExport(rows, fields, CHOICES, options)
}

function cell(sheet: string[][], header: string, rowIndex = 1): string {
  const index = sheet[0].indexOf(header)
  expect(index, `column "${header}" is missing`).toBeGreaterThanOrEqual(0)
  return sheet[index === -1 ? 0 : rowIndex][index]
}

/** The link on a Laporan cell, found by its header. */
function linkOf(sheets: ReturnType<typeof build>, header: string, rowIndex = 1) {
  const index = sheets.laporan[0].indexOf(header)
  expect(index, `column "${header}" is missing`).toBeGreaterThanOrEqual(0)
  return sheets.laporanLinks[rowIndex][index]
}

describe("wib formatting", () => {
  it("writes the Jakarta day and clock, not UTC", () => {
    // 2026-09-15T17:30Z is already the 16th, 00:30, in Jakarta.
    expect(wibDay("2026-09-15T17:30:00.000Z")).toBe("2026-09-16")
    expect(wibTime("2026-09-15T17:30:00.000Z")).toBe("00:30")
  })

  it("writes an empty cell for a missing or unreadable timestamp", () => {
    expect(wibDay(null)).toBe("")
    expect(wibTime("not a date")).toBe("")
  })
})

describe("buildReportExport header", () => {
  it("follows the admin's field order and uses their labels", () => {
    const fields = [
      field({ reportingKey: "meeting_summary", label: "Ringkasan pertemuan", fieldType: "LONG_TEXT", isCore: true, displayOrder: 30 }),
      field({ reportingKey: "visit_outcome", label: "Hasil kunjungan", fieldType: "SELECT", isCore: true, displayOrder: 10 }),
      field({ reportingKey: "catatan_tambahan", label: "Catatan tambahan", fieldType: "TEXT", displayOrder: 20 }),
    ]
    const { laporan } = build([row()], fields)
    const formColumns = laporan[0].slice(laporan[0].indexOf("Status laporan") + 1, laporan[0].indexOf("Catatan klarifikasi"))
    expect(formColumns).toEqual(["Hasil kunjungan", "Catatan tambahan", "Ringkasan pertemuan"])
  })

  it("uses a renamed field's current label while the frozen key still resolves the answer", () => {
    const fields = [field({ reportingKey: "visit_outcome", label: "Hasil", fieldType: "SELECT", isCore: true, displayOrder: 10 })]
    const { laporan } = build([row()], fields)
    expect(laporan[0]).toContain("Hasil")
    expect(laporan[0]).not.toContain("Hasil kunjungan")
    expect(cell(laporan, "Hasil")).toBe("Bertemu pengambil keputusan")
  })

  it("leaves an archived field out and never writes Waktu kunjungan twice", () => {
    const fields = [
      ...coreFields(),
      field({ reportingKey: "dibuang", label: "Dibuang", isActive: false, displayOrder: 999 }),
    ]
    const { laporan } = build([row()], fields)
    expect(laporan[0]).not.toContain("Dibuang")
    expect(laporan[0]).not.toContain("Waktu kunjungan")
    expect(laporan[0].filter((name) => name === "Jam mulai kunjungan")).toHaveLength(1)
  })

  it("starts with the activity's own facts and ends with the trail back to the record", () => {
    const { laporan } = build([row()])
    expect(laporan[0].slice(0, 3)).toEqual(["Perusahaan", "Jenis aktivitas", "Tanggal jadwal"])
    expect(laporan[0].slice(-3)).toEqual(["Tautan laporan", "ID aktivitas", "ID laporan"])
  })
})

describe("buildReportExport cells", () => {
  it("writes the activity facts, the people and the times in WIB", () => {
    const { laporan } = build([row()])
    expect(cell(laporan, "Perusahaan")).toBe("PT Arunika Kreasi")
    expect(cell(laporan, "Tanggal jadwal")).toBe("2026-09-15")
    expect(cell(laporan, "Jam mulai jadwal")).toBe("09:30")
    expect(cell(laporan, "Jam selesai jadwal")).toBe("11:00")
    expect(cell(laporan, "Tanggal kunjungan")).toBe("2026-09-15")
    expect(cell(laporan, "Jam mulai kunjungan")).toBe("09:45")
    expect(cell(laporan, "Jam selesai kunjungan")).toBe("11:10")
    expect(cell(laporan, "Sales utama")).toBe("Yulia")
    expect(cell(laporan, "Sales pendukung")).toBe("Budi, Sari")
  })

  it("turns choice codes into the tenant's labels and statuses into words", () => {
    const { laporan } = build([row({ status: "NEEDS_CLARIFICATION" })])
    expect(cell(laporan, "Status laporan")).toBe("Perlu klarifikasi")
    expect(cell(laporan, "Hasil kunjungan")).toBe("Bertemu pengambil keputusan")
    expect(cell(laporan, "Tingkat minat")).toBe("Hangat")
    expect(cell(laporan, "Next action")).toBe("Kirim proposal")
  })

  it("writes Ya/Tidak, joined lists and a plain number for money", () => {
    const { laporan, numericColumns } = build([row()])
    expect(cell(laporan, "Ada peluang")).toBe("Ya")
    expect(cell(laporan, "Kebutuhan klien")).toBe("Corporate gathering, Katering")
    expect(cell(laporan, "Produk yang diminati")).toBe("")
    expect(cell(laporan, "Estimasi nilai")).toBe("15000000")
    expect(numericColumns.has("Estimasi nilai")).toBe(true)
  })

  it("writes an empty cell rather than a word for what was never filled in", () => {
    const { laporan } = build([row({ estimatedValue: null, location: null, opportunityExists: false, clarificationNote: null })])
    expect(cell(laporan, "Estimasi nilai")).toBe("")
    expect(cell(laporan, "Lokasi")).toBe("")
    expect(cell(laporan, "Ada peluang")).toBe("Tidak")
    expect(cell(laporan, "Catatan klarifikasi")).toBe("")
    expect(laporan[1]).not.toContain("null")
  })

  it("records the lead push, the follow-up state and a link back to the report", () => {
    const { laporan } = build([
      row({
        pushedLeadId: "lead-9",
        pushedCategory: "HQL",
        followUp: { status: "OPEN", dueDate: "2026-09-18" },
      }),
    ], coreFields(), { ...OPTIONS, today: "2026-09-22" })
    expect(cell(laporan, "Dikirim ke Group Lead")).toBe("Ya")
    expect(cell(laporan, "Kategori lead")).toBe("HQL")
    expect(cell(laporan, "ID lead Group Lead")).toBe("lead-9")
    expect(cell(laporan, "Tindak lanjut")).toBe("Lewat")
    expect(cell(laporan, "Tanggal dikirim")).toBe("2026-09-15")
    expect(cell(laporan, "Jam dikirim")).toBe("17:05")
    expect(cell(laporan, "Tautan laporan")).toBe("https://mission.example/workspace/activities/mission-1?fokus=laporan")
  })

  it("makes Tautan laporan a real link to the address it shows", () => {
    const sheets = build([row()])
    const link = linkOf(sheets, "Tautan laporan")
    expect(link?.target).toBe(cell(sheets.laporan, "Tautan laporan"))
    expect(link?.tooltip).toMatch(/perlu masuk/)
  })

  it("keeps the links the same shape as the text, with plain cells and the header unlinked", () => {
    const sheets = build([row({ reportId: "a" }), row({ reportId: "b" })])
    expect(sheets.laporanLinks).toHaveLength(sheets.laporan.length)
    sheets.laporanLinks.forEach((links, index) => expect(links).toHaveLength(sheets.laporan[index].length))
    expect(sheets.laporanLinks[0].every((link) => link === null)).toBe(true)
    expect(linkOf(sheets, "Perusahaan")).toBeNull()
    expect(linkOf(sheets, "ID laporan")).toBeNull()
  })

  it("leaves the follow-up cell empty when the report has none", () => {
    const { laporan } = build([row()])
    expect(cell(laporan, "Tindak lanjut")).toBe("")
  })
})

describe("people met", () => {
  const nofri = contact({
    fullName: "Nofri Ardian",
    jobTitle: "GM Procurement",
    phone: "081234567890",
    email: "nofri@arunika.co.id",
    isDecisionMaker: true,
    discPrimary: "D",
    discSecondary: "I",
    discNote: "Langsung ke angka",
  })
  const sari = contact({
    fullName: "Sari",
    discPrimary: "S",
    discNote: "Minta angka tertulis",
    discAssessedByName: "Yulia",
    discAssessedAt: "2026-09-15T10:05:00.000Z",
  })

  /** The form columns of the Laporan sheet, between the activity block and the trail. */
  function formColumns(laporan: string[][]): string[] {
    return laporan[0].slice(laporan[0].indexOf("Status laporan") + 1, laporan[0].indexOf("Catatan klarifikasi"))
  }

  function group(number: number): string[] {
    return [
      `Kontak ${number} · Nama`,
      `Kontak ${number} · Jabatan`,
      `Kontak ${number} · Telepon`,
      `Kontak ${number} · Email`,
      `Kontak ${number} · Pengambil keputusan`,
      `Kontak ${number} · DISC`,
      `Kontak ${number} · Catatan DISC`,
    ]
  }

  it("gives each person their own columns, one fact per cell", () => {
    const { laporan } = build([row({ contacts: [nofri] })])
    expect(cell(laporan, "Kontak 1 · Nama")).toBe("Nofri Ardian")
    expect(cell(laporan, "Kontak 1 · Jabatan")).toBe("GM Procurement")
    expect(cell(laporan, "Kontak 1 · Telepon")).toBe("081234567890")
    expect(cell(laporan, "Kontak 1 · Email")).toBe("nofri@arunika.co.id")
    expect(cell(laporan, "Kontak 1 · Pengambil keputusan")).toBe("Ya")
    expect(cell(laporan, "Kontak 1 · DISC")).toBe("D/I")
    expect(cell(laporan, "Kontak 1 · Catatan DISC")).toBe("Langsung ke angka")
    expect(laporan[0]).not.toContain("Ketemu siapa")
  })

  it("writes one group per person and the same seven columns in order", () => {
    const { laporan } = build([row({ contacts: [nofri, sari] })])
    const headers = formColumns(laporan)
    const start = headers.indexOf("Kontak 1 · Nama")
    expect(headers.slice(start, start + 14)).toEqual([...group(1), ...group(2)])
    expect(cell(laporan, "Kontak 2 · Nama")).toBe("Sari")
    expect(cell(laporan, "Kontak 2 · DISC")).toBe("S")
    expect(cell(laporan, "Kontak 2 · Pengambil keputusan")).toBe("Tidak")
  })

  it("keeps one group even when nobody was met, with its cells empty", () => {
    const { laporan } = build([row()])
    const headers = formColumns(laporan)
    expect(headers.filter((name) => name.startsWith("Kontak "))).toEqual(group(1))
    expect(cell(laporan, "Kontak 1 · Nama")).toBe("")
    expect(cell(laporan, "Kontak 1 · Pengambil keputusan")).toBe("")
    expect(cell(laporan, "Kontak 1 · DISC")).toBe("")
  })

  it("counts the groups from the widest report and leaves the rest of a shorter row empty", () => {
    const { laporan } = build([
      row({ reportId: "a", contacts: [nofri] }),
      row({ reportId: "b", contacts: [nofri, sari, contact({ fullName: "Rangga" })] }),
    ])
    const headers = formColumns(laporan)
    expect(headers.filter((name) => name.startsWith("Kontak "))).toEqual([...group(1), ...group(2), ...group(3)])
    expect(cell(laporan, "Kontak 3 · Nama", 2)).toBe("Rangga")
    expect(cell(laporan, "Kontak 2 · Nama", 1)).toBe("")
    expect(cell(laporan, "Kontak 3 · Pengambil keputusan", 1)).toBe("")
    expect(laporan[1]).toHaveLength(laporan[0].length)
    expect(laporan[2]).toHaveLength(laporan[0].length)
  })

  it("leaves the DISC cell empty unless there is a reading, and hides a lone secondary letter", () => {
    const { laporan } = build([
      row({ reportId: "a", contacts: [contact({ fullName: "Sari" })] }),
      row({ reportId: "b", contacts: [contact({ fullName: "Sari", discSecondary: "C" })] }),
      row({ reportId: "c", contacts: [contact({ fullName: "Sari", discPrimary: "S" })] }),
    ])
    expect(cell(laporan, "Kontak 1 · DISC", 1)).toBe("")
    expect(cell(laporan, "Kontak 1 · DISC", 2)).toBe("")
    expect(cell(laporan, "Kontak 1 · DISC", 3)).toBe("S")
  })

  it("puts the groups where the admin put the field, and never renames them", () => {
    const fields = [
      field({ reportingKey: "contacts_met", label: "Siapa yang ditemui", fieldType: "CONTACTS", isCore: true, displayOrder: 30 }),
      field({ reportingKey: "meeting_summary", label: "Ringkasan pertemuan", fieldType: "LONG_TEXT", isCore: true, displayOrder: 20 }),
      field({ reportingKey: "catatan_lapangan", label: "Catatan lapangan", fieldType: "TEXT", displayOrder: 40 }),
    ]
    const { laporan } = build([row({ contacts: [nofri] })], fields)
    expect(formColumns(laporan)).toEqual(["Ringkasan pertemuan", ...group(1), "Catatan lapangan"])
    expect(laporan[0]).not.toContain("Siapa yang ditemui")
  })

  it("leaves the groups out when the admin archived the field", () => {
    const fields = coreFields().map((entry) =>
      entry.reportingKey === "contacts_met" ? { ...entry, isActive: false } : entry
    )
    const { laporan } = build([row({ contacts: [nofri] })], fields)
    expect(laporan[0].filter((name) => name.startsWith("Kontak "))).toEqual([])
  })

  it("never types a contact column as a number, so a phone keeps its leading zero", () => {
    const { numericColumns } = build([row({ contacts: [nofri, sari] })])
    expect([...numericColumns].filter((name) => name.startsWith("Kontak "))).toEqual([])
  })

  it("still gives one row per person on Kontak, with who read the DISC and when", () => {
    const { kontak } = build([row({ contacts: [nofri, sari] })])
    expect(kontak).toHaveLength(3)
    expect(cell(kontak, "Nama", 1)).toBe("Nofri Ardian")
    expect(cell(kontak, "Pengambil keputusan", 1)).toBe("Ya")
    expect(cell(kontak, "DISC utama", 2)).toBe("S")
    expect(cell(kontak, "Catatan DISC", 2)).toBe("Minta angka tertulis")
    expect(cell(kontak, "Dinilai oleh", 2)).toBe("Yulia")
    expect(cell(kontak, "Dinilai pada", 2)).toBe("2026-09-15 17:05")
    expect(cell(kontak, "ID laporan", 2)).toBe("report-1")
  })

  it("keeps the Kontak sheet even when nobody was met, so the file's shape never changes", () => {
    const { kontak } = build([row()])
    expect(kontak).toHaveLength(1)
    expect(kontak[0]).toContain("Nama")
  })
})

describe("supporting notes", () => {
  it("collects them into one cell, each said by its author, and onto their own sheet", () => {
    const { laporan, catatan } = build([
      row({
        supportingNotes: [
          { authorName: "Budi", note: "Klien minta contoh rundown.", createdAt: "2026-09-15T11:00:00.000Z" },
          { authorName: null, note: "Parkir penuh.", createdAt: "2026-09-15T11:30:00.000Z" },
        ],
      }),
    ])

    expect(cell(laporan, "Catatan pendukung")).toBe("Budi: Klien minta contoh rundown.\nParkir penuh.")
    expect(catatan).toHaveLength(3)
    expect(cell(catatan, "Penulis", 1)).toBe("Budi")
    expect(cell(catatan, "Catatan", 1)).toBe("Klien minta contoh rundown.")
    expect(cell(catatan, "Ditulis pada", 1)).toBe("2026-09-15 18:00")
    expect(cell(catatan, "ID aktivitas", 1)).toBe("mission-1")
  })

  it("has nothing but its header when no note was written, so the sheet can be left out", () => {
    const { catatan } = build([row()])
    expect(catatan).toHaveLength(1)
  })
})

describe("attachments", () => {
  const photos = [
    { path: PHOTO_PATH, name: "WhatsApp Image 2026-10-01 at 15.34.44.jpeg", size: 1000 },
    { path: PHOTO_PATH_2, name: "depan-kantor.jpg", size: 1000 },
    { path: PHOTO_PATH_3, name: "papan nama.png", size: 1000 },
  ]
  const audio = [{ path: AUDIO_PATH, name: "rapat.m4a", size: 2000 }]
  const photoLink = (path: string) => `https://mission.example/workspace/lampiran?jenis=foto&berkas=${path}`

  it("gives each file its own numbered column, named, and linked through the app", () => {
    const sheets = build([row({ custom: { visit_photos: photos, visit_audio: audio } })])
    const { laporan } = sheets

    expect(cell(laporan, "Foto bukti kunjungan 1")).toBe("WhatsApp Image 2026-10-01 at 15.34.44.jpeg")
    expect(cell(laporan, "Foto bukti kunjungan 2")).toBe("depan-kantor.jpg")
    expect(cell(laporan, "Foto bukti kunjungan 3")).toBe("papan nama.png")
    expect(cell(laporan, "Rekaman pertemuan 1")).toBe("rapat.m4a")
    expect(laporan[0]).not.toContain("Foto bukti kunjungan")
    expect(laporan[0]).not.toContain("Foto bukti kunjungan 4")

    expect(linkOf(sheets, "Foto bukti kunjungan 1")?.target).toBe(photoLink(PHOTO_PATH))
    expect(linkOf(sheets, "Foto bukti kunjungan 3")?.target).toBe(photoLink(PHOTO_PATH_3))
    expect(linkOf(sheets, "Rekaman pertemuan 1")?.target).toBe(
      `https://mission.example/workspace/lampiran?jenis=rekaman&berkas=${AUDIO_PATH}`
    )
    expect(linkOf(sheets, "Foto bukti kunjungan 1")?.tooltip).toBe("Buka foto (perlu masuk ke Sales Activity)")
    expect(linkOf(sheets, "Rekaman pertemuan 1")?.tooltip).toBe("Unduh rekaman (perlu masuk ke Sales Activity)")
  })

  it("writes the app's own address, never a storage link that expires or opens without a login", () => {
    const sheets = build([row({ custom: { visit_photos: photos, visit_audio: audio } })])
    const targets = sheets.laporanLinks.flat().filter((link) => link !== null).map((link) => link.target)
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect(target.startsWith("https://mission.example/workspace/")).toBe(true)
      expect(target).not.toMatch(/supabase|token=/)
    }
  })

  it("keeps the files in the order they were attached, one per column, with the header in the field's place", () => {
    const { laporan } = build([row({ custom: { visit_photos: photos } })])
    const headers = laporan[0]
    const first = headers.indexOf("Foto bukti kunjungan 1")
    expect(headers.slice(first, first + 3)).toEqual(attachmentHeaders("Foto bukti kunjungan", 3))
    expect(headers.indexOf("Foto kartu nama 1")).toBeGreaterThan(first + 2)
  })

  it("counts the columns from the report with the most files and leaves a shorter row empty and unlinked", () => {
    const sheets = build([
      row({ reportId: "a", custom: { visit_photos: photos.slice(0, 1) } }),
      row({ reportId: "b", custom: { visit_photos: photos } }),
    ])
    expect(sheets.laporan[0].filter((name) => name.startsWith("Foto bukti kunjungan "))).toHaveLength(3)
    expect(cell(sheets.laporan, "Foto bukti kunjungan 1", 1)).toBe("WhatsApp Image 2026-10-01 at 15.34.44.jpeg")
    expect(cell(sheets.laporan, "Foto bukti kunjungan 3", 1)).toBe("")
    expect(linkOf(sheets, "Foto bukti kunjungan 3", 1)).toBeNull()
    expect(cell(sheets.laporan, "Foto bukti kunjungan 3", 2)).toBe("papan nama.png")
    expect(sheets.laporan[1]).toHaveLength(sheets.laporan[0].length)
    expect(sheets.laporan[2]).toHaveLength(sheets.laporan[0].length)
  })

  it("keeps one column for a field nobody attached anything to, so the header always exists", () => {
    const sheets = build([row()])
    expect(sheets.laporan[0].filter((name) => name.startsWith("Foto kartu nama "))).toEqual(["Foto kartu nama 1"])
    expect(cell(sheets.laporan, "Foto kartu nama 1")).toBe("")
    expect(linkOf(sheets, "Foto kartu nama 1")).toBeNull()
    expect(cell(sheets.laporan, "Rekaman pertemuan 1")).toBe("")
  })

  it("reads a stored answer that arrives as JSON text", () => {
    const sheets = build([row({ custom: { visit_photos: JSON.stringify(photos.slice(1, 2)) } })])
    expect(cell(sheets.laporan, "Foto bukti kunjungan 1")).toBe("depan-kantor.jpg")
    expect(linkOf(sheets, "Foto bukti kunjungan 1")?.target).toBe(photoLink(PHOTO_PATH_2))
  })

  it("names a file by its stored file when the phone gave it no name, so a link is never blank", () => {
    const { laporan } = build([row({ custom: { visit_photos: [{ path: PHOTO_PATH, name: "  ", size: 10 }] } })])
    expect(cell(laporan, "Foto bukti kunjungan 1")).toBe("22222222-2222-4222-8222-222222222222.jpg")
  })

  it("names an unnamed recording as it downloads, so the cell and the file agree", () => {
    const { laporan } = build([row({ custom: { visit_audio: [{ path: AUDIO_PATH, name: "   ", size: 10 }] } })])
    expect(cell(laporan, "Rekaman pertemuan 1")).toBe(audioDownloadName({ path: AUDIO_PATH, name: "" }))
    expect(cell(laporan, "Rekaman pertemuan 1")).toMatch(/^rekaman\./)
  })

  it("spreads a custom photo field the admin added the same way, in the place they gave it", () => {
    const fields = [
      field({ reportingKey: "meeting_summary", label: "Ringkasan pertemuan", fieldType: "LONG_TEXT", isCore: true, displayOrder: 10 }),
      field({ reportingKey: "foto_produk", label: "Foto produk", fieldType: "PHOTO", displayOrder: 20 }),
      field({ reportingKey: "catatan_lapangan", label: "Catatan lapangan", fieldType: "TEXT", displayOrder: 30 }),
    ]
    const sheets = build([row({ custom: { foto_produk: photos.slice(0, 2) } })], fields)
    const formColumns = sheets.laporan[0].slice(
      sheets.laporan[0].indexOf("Status laporan") + 1,
      sheets.laporan[0].indexOf("Catatan klarifikasi")
    )
    expect(formColumns).toEqual(["Ringkasan pertemuan", "Foto produk 1", "Foto produk 2", "Catatan lapangan"])
    expect(linkOf(sheets, "Foto produk 2")?.target).toBe(photoLink(PHOTO_PATH_2))
  })

  it("never types a file column as a number, even when a number field carries the same label", () => {
    const fields = [
      field({ reportingKey: "visit_photos", label: "Foto", fieldType: "PHOTO", isCore: true, displayOrder: 10 }),
      field({ reportingKey: "jumlah", label: "Foto 1", fieldType: "NUMBER", displayOrder: 20 }),
    ]
    const { numericColumns } = build([row({ custom: { visit_photos: photos } })], fields)
    expect(numericColumns.has("Foto 1")).toBe(false)
  })

  it("counts columns per field: the most files any report has, never fewer than one", () => {
    const photoField = field({ reportingKey: "visit_photos", label: "Foto bukti kunjungan", fieldType: "PHOTO" })
    expect(attachmentColumnCount([], photoField)).toBe(1)
    expect(attachmentColumnCount([row()], photoField)).toBe(1)
    expect(
      attachmentColumnCount(
        [
          row({ custom: { visit_photos: photos.slice(0, 2) } }),
          row({ custom: { visit_photos: photos } }),
          row({ custom: { visit_photos: "not json" } }),
        ],
        photoField
      )
    ).toBe(3)
    // A malformed entry is not a file and does not earn a column.
    expect(attachmentColumnCount([row({ custom: { visit_photos: [{ path: "../etc/passwd", name: "x", size: 1 }] } })], photoField)).toBe(1)
    expect(attachmentHeaders("Rekaman pertemuan", 2)).toEqual(["Rekaman pertemuan 1", "Rekaman pertemuan 2"])
  })
})

describe("csv", () => {
  it("writes each file as its name and its permanent link, in the same numbered columns", () => {
    const sheets = build([
      row({
        custom: {
          visit_photos: [
            { path: PHOTO_PATH, name: "depan-kantor.jpg", size: 1000 },
            { path: PHOTO_PATH_2, name: "lobi.jpg", size: 1000 },
          ],
        },
      }),
    ])
    const csv = csvRows(sheets.laporan, sheets.laporanLinks)
    expect(csv[0]).toEqual(sheets.laporan[0])
    expect(cell(csv, "Foto bukti kunjungan 1")).toBe(
      `depan-kantor.jpg · https://mission.example/workspace/lampiran?jenis=foto&berkas=${PHOTO_PATH}`
    )
    expect(cell(csv, "Foto bukti kunjungan 2")).toBe(
      `lobi.jpg · https://mission.example/workspace/lampiran?jenis=foto&berkas=${PHOTO_PATH_2}`
    )
  })

  it("leaves a cell that already is its own link, and every plain cell, exactly as it is", () => {
    const sheets = build([row()])
    const csv = csvRows(sheets.laporan, sheets.laporanLinks)
    expect(cell(csv, "Tautan laporan")).toBe("https://mission.example/workspace/activities/mission-1?fokus=laporan")
    expect(cell(csv, "Perusahaan")).toBe("PT Arunika Kreasi")
    expect(cell(csv, "Foto bukti kunjungan 1")).toBe("")
  })
})

describe("custom fields", () => {
  const custom = [
    field({ reportingKey: "catatan_lapangan", label: "Catatan lapangan", fieldType: "LONG_TEXT", displayOrder: 200 }),
    field({ reportingKey: "jumlah_peserta", label: "Jumlah peserta", fieldType: "NUMBER", displayOrder: 210 }),
    field({ reportingKey: "biaya", label: "Biaya", fieldType: "CURRENCY", displayOrder: 220 }),
    field({ reportingKey: "tanggal_acara", label: "Tanggal acara", fieldType: "DATE", displayOrder: 230 }),
    field({ reportingKey: "jam_acara", label: "Jam acara", fieldType: "TIME", displayOrder: 240 }),
    field({ reportingKey: "butuh_survei", label: "Butuh survei", fieldType: "BOOLEAN", displayOrder: 250 }),
    field({ reportingKey: "lokasi_acara", label: "Lokasi acara", fieldType: "SELECT", displayOrder: 260, options: ["Hotel", "Kantor"] }),
    field({ reportingKey: "fasilitas", label: "Fasilitas", fieldType: "MULTI_SELECT", displayOrder: 270, options: ["Sound", "Panggung"] }),
  ]

  it("writes each type the way its field says to read it", () => {
    const { laporan, numericColumns } = build(
      [
        row({
          custom: {
            catatan_lapangan: "Dua lantai, lift kecil.",
            jumlah_peserta: 120,
            biaya: "2500000",
            tanggal_acara: "2026-10-01",
            jam_acara: "09:30",
            butuh_survei: true,
            lokasi_acara: "Hotel",
            fasilitas: ["Sound", "Panggung"],
          },
        }),
      ],
      custom
    )

    expect(cell(laporan, "Catatan lapangan")).toBe("Dua lantai, lift kecil.")
    expect(cell(laporan, "Jumlah peserta")).toBe("120")
    expect(cell(laporan, "Biaya")).toBe("2500000")
    expect(cell(laporan, "Tanggal acara")).toBe("2026-10-01")
    expect(cell(laporan, "Jam acara")).toBe("09:30")
    expect(cell(laporan, "Butuh survei")).toBe("Ya")
    expect(cell(laporan, "Lokasi acara")).toBe("Hotel")
    expect(cell(laporan, "Fasilitas")).toBe("Sound, Panggung")
    expect([...numericColumns].sort()).toEqual(["Biaya", "Jumlah peserta"])
  })

  it("leaves an unanswered field empty and a false switch as Tidak", () => {
    const { laporan } = build([row({ custom: { butuh_survei: false } })], custom)
    expect(cell(laporan, "Butuh survei")).toBe("Tidak")
    expect(cell(laporan, "Jumlah peserta")).toBe("")
    expect(cell(laporan, "Fasilitas")).toBe("")
  })
})

describe("many reports", () => {
  it("writes one row per report, in the order they arrived", () => {
    const { laporan } = build([row({ reportId: "a" }), row({ reportId: "b" }), row({ reportId: "c" })])
    expect(laporan).toHaveLength(4)
    expect(laporan.slice(1).map((line) => line[line.length - 1])).toEqual(["a", "b", "c"])
  })
})
