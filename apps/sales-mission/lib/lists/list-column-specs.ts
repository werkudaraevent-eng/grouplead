import type { ColumnSpec } from "./list-columns"
import type { SortColumn } from "@/lib/missions/mission-paging"
import type { ProspectSortColumn } from "@/lib/prospects/prospect-paging"
import type { ReportSortColumn } from "@/lib/reporting/report-paging"

/**
 * The columns of the three lists, in their default order.
 *
 * Every cell is one line on a 52dp row, so what used to sit on a second
 * line under a cell is a column of its own here, offered in the columns
 * menu, and the cell it came from still carries it in its title (hover).
 * The defaults are what fits a 1280px laptop with the drawer open (about
 * 1000px of table): the name, the few columns a person reads every row by,
 * and the action. The rest wait in the menu; turning them on makes the
 * table scroll sideways inside its card while the name stays put.
 *
 * Widths are sized to what a cell holds ("Besok, 09.00", a facepile, a
 * status label, one button); the locked name column's width is its
 * minimum, since it takes whatever the others leave.
 */

type Spec<S extends string> = ColumnSpec & { sort?: S }

export const ACTIVITY_COLUMNS: Spec<SortColumn>[] = [
  { id: "client", label: "Aktivitas", width: 180, locked: true, sort: "client" },
  { id: "type", label: "Jenis", width: 120, defaultVisible: true },
  { id: "schedule", label: "Jadwal", width: 120, defaultVisible: true, sort: "schedule" },
  { id: "location", label: "Lokasi", width: 170, sort: "location" },
  { id: "sales", label: "Sales utama", width: 170, defaultVisible: true, sort: "sales" },
  { id: "status", label: "Status", width: 170, defaultVisible: true, sort: "status" },
  { id: "outcome", label: "Hasil", width: 180 },
  { id: "assignment", label: "Penugasan", width: 170 },
  { id: "industry", label: "Industri", width: 150 },
  { id: "creator", label: "Dibuat oleh", width: 160 },
]

export const PROSPECT_COLUMNS: Spec<ProspectSortColumn>[] = [
  { id: "company", label: "Perusahaan", width: 170, locked: true, sort: "company" },
  { id: "contact", label: "Kontak", width: 140, defaultVisible: true, sort: "contact" },
  { id: "phone", label: "Telepon", width: 150 },
  { id: "email", label: "Email", width: 190 },
  { id: "job_title", label: "Jabatan", width: 150 },
  { id: "status", label: "Status", width: 160, defaultVisible: true, sort: "status" },
  { id: "next_contact", label: "Hubungi lagi", width: 140, defaultVisible: true, sort: "next_contact" },
  { id: "last_contact", label: "Terakhir dihubungi", width: 160, sort: "last_contact" },
  { id: "owner", label: "Pemegang", width: 150, defaultVisible: true, sort: "owner" },
  { id: "industry", label: "Industri", width: 150 },
  { id: "location", label: "Lokasi", width: 150 },
  { id: "created", label: "Dibuat", width: 120, sort: "created" },
]

export const REPORT_COLUMNS: Spec<ReportSortColumn>[] = [
  { id: "client", label: "Perusahaan", width: 180, locked: true, sort: "client" },
  { id: "visit", label: "Waktu kunjungan", width: 180, defaultVisible: true, sort: "actual" },
  { id: "type", label: "Jenis", width: 130 },
  { id: "sales", label: "Sales utama", width: 160, defaultVisible: true, sort: "sales" },
  { id: "outcome", label: "Hasil", width: 160, defaultVisible: true, sort: "outcome" },
  { id: "interest", label: "Minat", width: 130, sort: "interest" },
  { id: "value", label: "Peluang", width: 140, sort: "value" },
  { id: "next_action", label: "Next action", width: 160, defaultVisible: true, sort: "follow_up" },
  { id: "follow_up", label: "Tindak lanjut", width: 200 },
  { id: "status", label: "Status", width: 140, defaultVisible: true, sort: "submitted" },
  { id: "lead", label: "Lead", width: 120 },
]

/**
 * The trailing action column of Aktivitas and Prospek: frozen at the
 * trailing edge, never in the menu. Wide enough for its longest button
 * ("Lanjutkan laporan") inside the cell's padding.
 */
export const ACTION_COLUMN_WIDTH = 180
