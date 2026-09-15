"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload } from "@/components/icons"
import * as XLSX from "xlsx"
import {
  checkMissionImport,
  commitMissionImport,
  type ImportCheck,
} from "@/app/actions/mission-import-actions"
import type { RawRow } from "@/lib/missions/mission-io"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Import missions from a spreadsheet.
 *
 * Check first, write second. The file is parsed in the browser, validated in
 * full on the server, and nothing is created until the user has seen how many
 * rows passed and exactly what is wrong with the rest. Importing straight from
 * the upload would mean discovering a typo in row 40 after 39 real visits had
 * already been scheduled and notified.
 */
export function ImportMissions() {
  const [open, setOpen] = useState(false)
  const [check, setCheck] = useState<ImportCheck | null>(null)
  const [rows, setRows] = useState<RawRow[]>([])
  const [fileName, setFileName] = useState("")
  const [reading, setReading] = useState(false)
  const [pending, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const reset = () => {
    setCheck(null)
    setRows([])
    setFileName("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const readFile = async (file: File) => {
    setReading(true)
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheet = book.Sheets[book.SheetNames[0]]
      // raw:false hands us formatted strings, so an Excel date cell arrives as
      // text rather than a serial the parser has to guess at.
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      })

      // The template marks required columns with " *", which is guidance for
      // the reader and not part of the column name.
      const cleaned: RawRow[] = parsed.map((row) => {
        const next: RawRow = {}
        for (const [key, value] of Object.entries(row)) {
          next[key.replace(/\s*\*\s*$/, "").trim()] = String(value ?? "").trim()
        }
        return next
      })

      const filled = cleaned.filter((row) => Object.values(row).some((value) => value !== ""))
      setRows(filled)
      setFileName(file.name)
      setCheck(await checkMissionImport(filled))
    } catch {
      toast.error("File tidak bisa dibaca. Pastikan formatnya .xlsx.")
      reset()
    } finally {
      setReading(false)
    }
  }

  const commit = () => {
    start(async () => {
      const result = await commitMissionImport(rows)
      if (result.success) {
        toast.success(`${result.created} mission dibuat.`)
        setOpen(false)
        reset()
        router.refresh()
      } else {
        toast.error(result.error ?? "Import gagal.")
      }
    })
  }

  const issuesByRow = new Map<number, string[]>()
  for (const issue of check?.issues ?? []) {
    const list = issuesByRow.get(issue.row) ?? []
    list.push(`${issue.column}: ${issue.message}`)
    issuesByRow.set(issue.row, list)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Closing mid-review throws away an uploaded file and its findings,
          // so it only closes on an explicit action while work is in flight.
          if (!next && (pending || reading)) return
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import mission</DialogTitle>
            <DialogDescription>
              Unduh template lebih dulu. Kolomnya mengikuti pengaturan form unit bisnis ini,
              jadi template lama bisa saja sudah tidak cocok.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <Button asChild variant="outline" className="h-12 w-full sm:w-auto">
              <a href="/workspace/missions/template">
                <Download className="h-4 w-4" /> Unduh template .xlsx
              </a>
            </Button>

            <div className="rounded-lg border border-dashed p-4">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                id="mission-import-file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) readFile(file)
                }}
              />
              <label
                htmlFor="mission-import-file"
                className="flex min-h-12 cursor-pointer items-center gap-2.5 text-sm"
              >
                <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    {fileName || "Pilih file .xlsx"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Baris pertama harus judul kolom dari template.
                  </span>
                </span>
                {reading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </label>
            </div>

            {check && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)] px-3 py-1.5 text-[var(--success-foreground)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {check.validRows.length} baris siap
                  </span>
                  {issuesByRow.size > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)] px-3 py-1.5 text-[var(--danger-foreground)]">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {issuesByRow.size} baris bermasalah
                    </span>
                  )}
                  {check.linkedCompanies > 0 && (
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
                      {check.linkedCompanies} perusahaan tertaut ke CRM
                    </span>
                  )}
                </div>

                {issuesByRow.size > 0 && (
                  <div className="max-h-56 overflow-auto rounded-lg border">
                    <ul className="divide-y text-sm">
                      {[...issuesByRow.entries()].map(([row, messages]) => (
                        <li key={row} className="px-4 py-3">
                          <p className="font-medium text-foreground">Baris {row}</p>
                          <ul className="mt-1 space-y-0.5">
                            {messages.map((message, index) => (
                              <li key={index} className="text-xs text-[var(--danger-foreground)]">
                                {message}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {issuesByRow.size > 0 && check.validRows.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Baris bermasalah dilewati. Perbaiki di file lalu import lagi kalau perlu.
                  </p>
                )}
                {check.error && (
                  <p className="text-sm text-[var(--danger-foreground)]">{check.error}</p>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset() }} disabled={pending}>
              Batal
            </Button>
            <Button onClick={commit} disabled={pending || reading || !check?.validRows.length}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {check?.validRows.length
                ? `Import ${check.validRows.length} mission`
                : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
