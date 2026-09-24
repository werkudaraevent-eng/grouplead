"use client"

import { useState } from "react"
import { Loader2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VIEW_NAME_MAX } from "@/lib/lists/list-views"

/**
 * Name a view: "Simpan tampilan", "Simpan sebagai tampilan baru" and
 * "Ubah nama" share it. Enter saves; Simpan is never greyed out, an empty
 * name says so under the field instead (the rule "Pressing send always
 * does something"). The dialog's own focus lands on the field.
 */
export function ViewNameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  action = "Simpan",
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initialName?: string
  action?: string
  /** Resolves true when saved, so the dialog closes. */
  onSubmit: (name: string) => Promise<boolean>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* The content mounts on every opening, so the form starts from the given name each time. */}
        <NameForm key={initialName} title={title} description={description} initialName={initialName} action={action} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  description,
  initialName,
  action,
  onSubmit,
  onCancel,
}: {
  title: string
  description: string
  initialName: string
  action: string
  onSubmit: (name: string) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Beri nama tampilannya.")
      return
    }
    setSaving(true)
    const ok = await onSubmit(trimmed)
    setSaving(false)
    if (ok) onCancel()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="view-name">Nama tampilan</Label>
        <Input
          id="view-name"
          value={name}
          maxLength={VIEW_NAME_MAX}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError(null)
          }}
          placeholder="Misal: Tim Jakarta minggu ini"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "view-name-error" : undefined}
          className="h-11 md:h-9"
        />
        {error && (
          <p id="view-name-error" className="text-xs text-[var(--danger-foreground)]">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {action}
        </Button>
      </DialogFooter>
    </form>
  )
}
