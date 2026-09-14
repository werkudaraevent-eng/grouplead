"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * The list of choices behind a dropdown or a multi-select.
 *
 * The old version could only append and delete. Fixing a typo meant deleting
 * the option and adding it again, which pushed it to the bottom of the list and
 * detached it from every answer already recorded against that exact string.
 * Editing in place is the common case, so it is the default gesture here: every
 * option is a live input.
 *
 * Usage counts sit beside each option because "can I delete this" is the only
 * question an admin actually has, and the answer is a number.
 */

export function OptionsEditor({
  options,
  onChange,
  usage,
  usageLoading,
  disabled,
  error,
}: {
  options: string[]
  onChange: (next: string[]) => void
  /** Answers recorded per option. Missing means not counted yet. */
  usage: Record<string, number> | null
  usageLoading: boolean
  disabled?: boolean
  error?: string | null
}) {
  const [draft, setDraft] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  /*
    What each row was called when the editor opened, moving with the row.

    Usage counts are keyed by the stored value, so looking them up by the live
    input meant the count and its rename warning vanished on the first
    keystroke: exactly when the admin is deciding whether renaming is safe.
    Keeping the origin lets the note stay, and stay truthful, by naming the
    value the answers are actually recorded against.

    null marks a row added in this session, which has no history to warn about.
  */
  const [origins, setOrigins] = useState<Array<string | null>>(() => [...options])

  const add = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    // Silence was the old behaviour here, so a duplicate looked like a button
    // that had stopped working. Compared trimmed, so "Meeting " is caught too.
    if (options.some((option) => option.trim() === trimmed)) {
      setAddError(`"${trimmed}" sudah ada di daftar.`)
      return
    }
    onChange([...options, trimmed])
    setOrigins((prev) => [...prev, null])
    setDraft("")
    setAddError(null)
  }

  const rename = (index: number, value: string) => {
    const next = [...options]
    next[index] = value
    onChange(next)
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= options.length) return
    const next = [...options]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    // Origins ride along, or a reorder would hand each row its neighbour's history.
    setOrigins((prev) => {
      const moved = [...prev]
      ;[moved[index], moved[target]] = [moved[target], moved[index]]
      return moved
    })
  }

  const remove = (index: number) => {
    onChange(options.filter((_, i) => i !== index))
    setOrigins((prev) => prev.filter((_, i) => i !== index))
  }

  /*
    Compared trimmed, and the positions are what is marked.

    The old check mixed the two: it filtered raw values but looked each one up
    with `indexOf(option.trim())`, so "Meeting" and "Meeting " never matched
    each other. Save stayed enabled, and the server rejected the pair with a
    message that pointed at no particular row.
  */
  const duplicatePositions = new Set<number>()
  const firstSeenAt = new Map<string, number>()
  options.forEach((option, index) => {
    const normalised = option.trim()
    if (!normalised) return
    const first = firstSeenAt.get(normalised)
    if (first === undefined) firstSeenAt.set(normalised, index)
    else {
      duplicatePositions.add(first)
      duplicatePositions.add(index)
    }
  })

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Opsi pilihan</p>
        <p className="text-xs text-muted-foreground">
          Urutannya menentukan urutan di form.
        </p>
      </div>

      {options.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada opsi. Field pilihan butuh minimal satu.
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((option, index) => {
            const origin = origins[index] ?? null
            const count = origin === null ? undefined : usage?.[origin]
            const renamed = origin !== null && origin !== option.trim()
            const isDuplicate = duplicatePositions.has(index)

            return (
              // Keyed by position, not by text. The text is what is being typed,
              // so a text key would change on every keystroke and the input
              // would lose focus each character. The inputs are controlled and
              // hold no state of their own, which is what makes an index key
              // safe here.
              <li key={index} className="flex items-start gap-2">
                {/* The position, not a drag handle. A grip icon sat here and
                    invited a gesture the list does not support; the number
                    answers the question the grip only implied. */}
                <span className="mt-3 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground" aria-hidden="true">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <Input
                    className="h-11"
                    value={option}
                    maxLength={100}
                    disabled={disabled}
                    aria-label={`Opsi ${index + 1}`}
                    aria-invalid={isDuplicate || undefined}
                    onChange={(e) => rename(index, e.target.value)}
                  />
                  {isDuplicate && (
                    <p className="mt-1 text-xs text-[var(--danger-foreground)]">Opsi ini kembar.</p>
                  )}
                  {/* Renaming leaves old answers on the old string, so the
                      count is the warning, not a decoration. */}
                  {count !== undefined && count > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {renamed
                        ? `Dipakai ${count} mission dengan nama lama "${origin}". Data lama tetap tersimpan dengan nama itu.`
                        : `Dipakai ${count} mission. Mengganti namanya tidak mengubah data lama.`}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Naikkan opsi ${option || index + 1}`}
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                    className="grid h-11 w-9 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Turunkan opsi ${option || index + 1}`}
                    disabled={disabled || index === options.length - 1}
                    onClick={() => move(index, 1)}
                    className="grid h-11 w-9 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      count
                        ? `Hapus opsi ${option}, dipakai ${count} mission`
                        : `Hapus opsi ${option || index + 1}`
                    }
                    disabled={disabled}
                    onClick={() => remove(index)}
                    className="grid h-11 w-9 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-[var(--danger-foreground)] disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {usageLoading && (
        <p className="text-xs text-muted-foreground">Menghitung pemakaian tiap opsi…</p>
      )}

      <div className="flex gap-2 pt-1">
        <Input
          className="h-11"
          value={draft}
          maxLength={100}
          disabled={disabled}
          aria-label="Opsi baru"
          onChange={(e) => { setDraft(e.target.value); setAddError(null) }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder="Tulis opsi baru, lalu Enter"
        />
        <Button type="button" variant="outline" className="h-11 shrink-0" disabled={disabled || !draft.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {(addError || error) && (
        <p className="text-sm text-[var(--danger-foreground)]">{addError ?? error}</p>
      )}
    </div>
  )
}
