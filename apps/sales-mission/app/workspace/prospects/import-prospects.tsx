"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload } from "@/components/icons"
import * as XLSX from "xlsx"
import { checkProspectImport, commitProspectImport, type ProspectImportCheck } from "@/app/actions/prospect-import-actions"
import type { RawRow } from "@/lib/missions/mission-io"
import { PersonPicker, type Person } from "@/app/workspace/missions/new/people-picker"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Import prospects from a spreadsheet: check first, write second, as the
 * mission import does. Duplicates are shown as their own count because
 * they are the common case with a list that has been worked before.
 */
export function ImportProspects({ people, canAssignOthers, viewerId }: { people: Person[]; canAssignOthers: boolean; viewerId: string }) {
  const [open, setOpen] = useState(false)
  const [check, setCheck] = useState<ProspectImportCheck | null>(null)
  const [rows, setRows] = useState<RawRow[]>([])
  const [fileName, setFileName] = useState("")
  const [reading, setReading] = useState(false)
  const [ownerId, setOwnerId] = useState(canAssignOthers ? "" : viewerId)
  const [pending, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const reset = () => {
    setCheck(null); setRows([]); setFileName("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const readFile = async (file: File) => {
    setReading(true)
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheet = book.Sheets[book.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
      const cleaned: RawRow[] = parsed.map((row) => {
        const next: RawRow = {}
        for (const [key, value] of Object.entries(row)) next[key.replace(/\s*\*\s*$/, "").trim()] = String(value ?? "").trim()
        return next
      })
      const filled = cleaned.filter((row) => Object.values(row).some((value) => value !== ""))
      setRows(filled)
      setFileName(file.name)
      setCheck(await checkProspectImport(filled))
    } catch {
      toast.error("File tidak bisa dibaca. Pastikan formatnya .xlsx.")
      reset()
    } finally {
      setReading(false)
    }
  }

  const commit = () => {
    start(async () => {
      const result = await commitProspectImport(rows, { defaultOwnerId: ownerId || null, fileName })
      if (result.success) {
        toast.success(`${result.created} prospek diimpor${result.skipped ? `, ${result.skipped} dilewati` : ""}.`)
        setOpen(false); reset(); router.refresh()
      } else toast.error(result.error ?? "Impor gagal.")
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

      <Dialog open={open} onOpenChange={(next) => { if (!next && (pending || reading)) return; setOpen(next); if (!next) reset() }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import prospek</DialogTitle>
            <DialogDescription>Unduh template lebih dulu. Baris yang teleponnya, atau nama perusahaan dan kontaknya, sudah ada di daftar akan dilewati.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <Button asChild variant="outline" className="h-12 w-full sm:w-auto">
              <a href="/workspace/prospects/template"><Download className="h-4 w-4" /> Unduh template .xlsx</a>
            </Button>

            <div className="rounded-lg border border-dashed p-4">
              <input ref={inputRef} type="file" accept=".xlsx,.xls" id="prospect-import-file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file) }} />
              <label htmlFor="prospect-import-file" className="flex min-h-12 cursor-pointer items-center gap-2.5 text-sm">
                <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{fileName || "Pilih file .xlsx"}</span>
                  <span className="block text-xs text-muted-foreground">Baris pertama harus judul kolom dari template.</span>
                </span>
                {reading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-owner" className="text-foreground">Pemegang untuk baris tanpa email pemegang <span className="font-normal text-muted-foreground">(opsional)</span></Label>
              {canAssignOthers ? (
                <PersonPicker id="import-owner" name="ownerId" people={people} value={ownerId} onChange={setOwnerId} placeholder="Belum ditentukan" />
              ) : (
                <p className="text-sm text-muted-foreground">Prospek yang diimpor menjadi milikmu, kecuali baris yang menyebut email pemegang lain.</p>
              )}
            </div>

            {check && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success)] px-3 py-1.5 text-[var(--success-foreground)]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {check.validRows.length} baris siap
                  </span>
                  {check.duplicates > 0 && (
                    <span className="inline-flex items-center rounded-full bg-[var(--warning)] px-3 py-1.5 text-[var(--warning-foreground)]">{check.duplicates} duplikat dilewati</span>
                  )}
                  {issuesByRow.size - check.duplicates > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)] px-3 py-1.5 text-[var(--danger-foreground)]">
                      <AlertCircle className="h-3.5 w-3.5" /> {Math.max(0, issuesByRow.size - check.duplicates)} baris bermasalah
                    </span>
                  )}
                  {check.linkedCompanies > 0 && (
                    <span className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-muted-foreground">{check.linkedCompanies} perusahaan tertaut ke CRM</span>
                  )}
                </div>
                {issuesByRow.size > 0 && (
                  <div className="max-h-56 overflow-auto rounded-lg border">
                    <ul className="divide-y text-sm">
                      {[...issuesByRow.entries()].map(([row, messages]) => (
                        <li key={row} className="px-4 py-3">
                          <p className="font-medium text-foreground">Baris {row}</p>
                          <ul className="mt-1 space-y-0.5">
                            {messages.map((message, index) => <li key={index} className="text-xs text-muted-foreground">{message}</li>)}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {check.error && <p className="text-sm text-[var(--danger-foreground)]">{check.error}</p>}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset() }} disabled={pending}>Batal</Button>
            <Button onClick={commit} disabled={pending || reading || !check?.validRows.length}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {check?.validRows.length ? `Import ${check.validRows.length} prospek` : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
