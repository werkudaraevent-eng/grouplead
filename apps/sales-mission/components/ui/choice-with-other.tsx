"use client"

import { useState } from "react"
import { Plus, X } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Choice controls for uncontrolled forms that may accept an answer off the
 * list, when the admin switched that on for the field.
 *
 * The pattern is Google Forms' "Other": the list stays the list, and one
 * extra entry opens a text field. The typed value travels under the same
 * form name as the listed ones, so the server reads it like any answer.
 */

const SELECT_CLASS =
  "h-12 w-full rounded-md border border-input bg-field px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const OTHER = "__other__"

export function SelectWithOther({
  id,
  name,
  options,
  defaultValue,
  required,
  placeholder,
  allowOther,
  className,
  onChange,
}: {
  id: string
  name: string
  options: string[]
  defaultValue?: string
  required?: boolean
  placeholder?: string
  allowOther: boolean
  className?: string
  /** The value as it will be submitted, whenever it changes. */
  onChange?: (value: string) => void
}) {
  const initial = defaultValue ?? ""
  const startsOff = allowOther && initial !== "" && !options.includes(initial)
  const [choice, setChoice] = useState(startsOff ? OTHER : initial)
  const [other, setOther] = useState(startsOff ? initial : "")

  if (!allowOther) {
    return (
      <select id={id} name={name} required={required} defaultValue={initial} onChange={(event) => onChange?.(event.target.value)} className={cn(SELECT_CLASS, className)}>
        <option value="">{placeholder ?? "Pilih salah satu"}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    )
  }

  return (
    <div className="space-y-2">
      <select
        id={id}
        // The select only carries a listed value; the typed one rides on a
        // hidden input under the same name, so exactly one reaches the server.
        name={choice === OTHER ? undefined : name}
        required={required && choice !== OTHER}
        value={choice}
        onChange={(event) => {
          setChoice(event.target.value)
          onChange?.(event.target.value === OTHER ? other.trim() : event.target.value)
        }}
        className={cn(SELECT_CLASS, className)}
      >
        <option value="">{placeholder ?? "Pilih salah satu"}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
        <option value={OTHER}>Lainnya…</option>
      </select>
      {choice === OTHER && (
        <>
          <Input
            aria-label="Tulis pilihan lain"
            value={other}
            required={required}
            maxLength={100}
            autoFocus={!startsOff}
            onChange={(event) => {
              setOther(event.target.value)
              onChange?.(event.target.value.trim())
            }}
            placeholder="Tulis pilihan lain"
            className="h-12"
          />
          <input type="hidden" name={name} value={other.trim()} />
        </>
      )}
    </div>
  )
}

export function MultiChoiceWithOther({
  id,
  name,
  options,
  defaultValue = [],
  allowOther,
}: {
  id: string
  name: string
  options: string[]
  defaultValue?: string[]
  allowOther: boolean
}) {
  const [extras, setExtras] = useState<string[]>(() => defaultValue.filter((item) => !options.includes(item)))
  const [draft, setDraft] = useState("")

  const add = () => {
    const value = draft.trim()
    if (!value) return
    if (!options.includes(value) && !extras.includes(value)) setExtras((list) => [...list, value])
    setDraft("")
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {options.map((option) => (
          <div className="flex min-h-12 items-center gap-2.5" key={option}>
            <Checkbox id={`${id}-${option}`} name={name} value={option} defaultChecked={defaultValue.includes(option)} />
            <Label htmlFor={`${id}-${option}`} className="font-normal text-foreground">{option}</Label>
          </div>
        ))}
        {extras.map((extra) => (
          <div className="flex min-h-12 items-center gap-2.5" key={extra}>
            <input type="hidden" name={name} value={extra} />
            <span className="inline-flex h-8 items-center gap-1 rounded-full border bg-primary/10 pl-3 pr-1 text-sm text-foreground">
              {extra}
              <button type="button" aria-label={`Hapus ${extra}`} onClick={() => setExtras((list) => list.filter((item) => item !== extra))} className="grid h-6 w-6 place-items-center rounded-full hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>
      {allowOther && (
        <div className="flex gap-2">
          <Input
            aria-label="Pilihan lain"
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add() } }}
            placeholder="Lainnya…"
            className="h-11 max-w-xs"
          />
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={add} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        </div>
      )}
    </div>
  )
}
