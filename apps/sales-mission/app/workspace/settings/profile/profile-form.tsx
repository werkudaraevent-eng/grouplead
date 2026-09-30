"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Camera, Eye, EyeOff, KeyRound, Loader2, Save } from "@/components/icons"
import { changePassword, setProfilePhoto, updateProfile } from "@/app/actions/profile-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { initialsOf } from "@/components/person-avatar"
import { createClient } from "@/utils/supabase/client"
import { catchStaleDeployment } from "@/lib/deploy/stale-announce"
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  PASSWORD_MIN,
  avatarObjectPath,
  isAvatarType,
  passwordSchema,
  profileSchema,
} from "@/lib/profile/profile-schema"
import type { MyProfile } from "@/lib/profile/profile-queries"

/**
 * Profil, in LeadEngine's order: the photo, what the admin decides (email,
 * role), what the person decides (name, phone, job title), the password.
 * One card per question, a hairline between a card's header and its body
 * (Pengaturan's cards), the save at the card's trailing edge.
 */
export function ProfileForm({ userId, profile }: { userId: string; profile: MyProfile }) {
  const [name, setName] = useState(profile.fullName)
  return (
    <div className="space-y-4">
      <PhotoCard userId={userId} name={name} email={profile.email} initialUrl={profile.avatarUrl} />
      <AccountCard email={profile.email} roleName={profile.roleName} />
      <DetailsCard profile={profile} onSaved={setName} />
      <PasswordCard />
    </div>
  )
}

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        <span>
          {label}
          {required && <span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>}
        </span>
      </Label>
      {children}
      {/* The error takes the supporting text's place (M3 text field). */}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-[var(--danger-foreground)]" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * The photo: uploaded from this browser under the person's own session to
 * the bucket and path LeadEngine's Profile writes (`avatars/<id>.<ext>`),
 * then saved on the profile. An explicit button rather than LeadEngine's
 * hover overlay, which a phone cannot hover.
 */
function PhotoCard({ userId, name, email, initialUrl }: { userId: string; name: string; email: string; initialUrl: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File) => {
    if (!isAvatarType(file.type)) { toast.error("Pilih foto JPG, PNG, WebP, atau GIF."); return }
    if (file.size > AVATAR_MAX_BYTES) { toast.error("Foto paling besar 5 MB."); return }
    setUploading(true)
    try {
      const supabase = createClient()
      const path = avatarObjectPath(userId, file.type)
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (error) { toast.error("Foto gagal diunggah. Periksa koneksi lalu coba lagi."); return }
      // The file keeps its name, so the address changes with each upload
      // or every browser would keep showing the old photo.
      const next = `${supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl}?t=${Date.now()}`
      const result = await setProfilePhoto({ url: next })
      if (!result.success) { toast.error(result.error ?? "Foto gagal disimpan. Coba lagi."); return }
      setUrl(next)
      toast.success("Foto profil diganti.")
      router.refresh()
    } catch (error) {
      if (!catchStaleDeployment(error)) toast.error("Foto gagal diunggah. Coba lagi.")
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <section aria-label="Foto profil" className="overflow-clip rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-4 px-5 py-5">
        <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-lg font-bold text-muted-foreground">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{name}</p>
          {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={uploading} className="max-sm:w-full">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {uploading ? "Mengunggah…" : url ? "Ganti foto" : "Pasang foto"}
        </Button>
      </div>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">
        Foto tampil di Sales Activity dan Group Lead. JPG, PNG, WebP, atau GIF, paling besar 5 MB.
      </p>
    </section>
  )
}

/** What the admin decides: read, not edited. Facts as rows, not disabled fields. */
function AccountCard({ email, roleName }: { email: string; roleName: string | null }) {
  return (
    <section aria-labelledby="profile-account" className="overflow-clip rounded-xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 id="profile-account" className="text-base font-semibold text-foreground">Akun</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Email untuk masuk dan peranmu diatur admin di Group Lead.</p>
      </header>
      <dl className="divide-y">
        <div className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-sm text-muted-foreground">Email</dt>
          <dd className="min-w-0 break-words text-sm text-foreground">{email || "—"}</dd>
        </div>
        <div className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-sm text-muted-foreground">Peran</dt>
          <dd className="min-w-0 break-words text-sm text-foreground">{roleName || "—"}</dd>
        </div>
      </dl>
    </section>
  )
}

function DetailsCard({ profile, onSaved }: { profile: MyProfile; onSaved: (name: string) => void }) {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: profile.fullName, phone: profile.phone, jobTitle: profile.jobTitle })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({})
  const [pending, start] = useTransition()

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = profileSchema.safeParse(form)
    if (!parsed.success) {
      const next: Partial<Record<keyof typeof form, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof form
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    start(async () => {
      try {
        const result = await updateProfile(form)
        if (!result.success) { toast.error(result.error ?? "Profil gagal disimpan. Coba lagi."); return }
        onSaved(parsed.data.fullName)
        toast.success("Profil tersimpan.")
        router.refresh()
      } catch (error) {
        if (!catchStaleDeployment(error)) toast.error("Profil gagal disimpan. Coba lagi.")
      }
    })
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby="profile-details" className="overflow-clip rounded-xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 id="profile-details" className="text-base font-semibold text-foreground">Data diri</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Nama yang dilihat tim, dan cara menghubungimu.</p>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="profile-name" label="Nama lengkap" required error={errors.fullName}>
            <Input
              id="profile-name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              autoComplete="name"
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={errors.fullName ? "profile-name-error" : undefined}
              className="h-12 md:h-10"
            />
          </Field>
        </div>
        <Field id="profile-phone" label="Nomor telepon" error={errors.phone}>
          <PhoneInput id="profile-phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} inputClassName="h-12 md:h-10" />
        </Field>
        <Field id="profile-job-title" label="Jabatan" error={errors.jobTitle}>
          <Input
            id="profile-job-title"
            value={form.jobTitle}
            onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}
            placeholder="Misalnya Sales Manager"
            autoComplete="organization-title"
            aria-invalid={errors.jobTitle ? true : undefined}
            className="h-12 md:h-10"
          />
        </Field>
      </div>
      <div className="flex justify-end border-t px-5 py-4">
        <Button type="submit" disabled={pending} className="h-12 max-sm:w-full md:h-10">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan profil
        </Button>
      </div>
    </form>
  )
}

function PasswordField({ id, label, value, onChange, error, hint }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint?: string }) {
  const [shown, setShown] = useState(false)
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-12 pr-12 md:h-10"
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}

/**
 * A new password. Supabase Auth ends every other session of the account in
 * the same step, as it does in LeadEngine, so the card says so before the
 * button is pressed; this device stays signed in.
 */
function PasswordCard() {
  const router = useRouter()
  const [form, setForm] = useState({ password: "", confirm: "" })
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [pending, start] = useTransition()

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = passwordSchema.safeParse(form)
    if (!parsed.success) {
      const next: { password?: string; confirm?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "password" | "confirm"
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    start(async () => {
      try {
        const result = await changePassword(form)
        if (!result.success) { toast.error(result.error ?? "Kata sandi gagal diganti. Coba lagi."); return }
        setForm({ password: "", confirm: "" })
        toast.success("Kata sandi diganti. Perangkat lain sudah dikeluarkan.")
        router.refresh()
      } catch (error) {
        if (!catchStaleDeployment(error)) toast.error("Kata sandi gagal diganti. Coba lagi.")
      }
    })
  }

  return (
    <form onSubmit={save} noValidate aria-labelledby="profile-password" className="overflow-clip rounded-xl border bg-card">
      <header className="border-b px-5 py-4">
        <h2 id="profile-password" className="text-base font-semibold text-foreground">Kata sandi</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Perangkat ini tetap masuk; semua perangkat lain keluar dan harus masuk lagi dengan kata sandi baru.</p>
      </header>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-2">
        <PasswordField
          id="profile-password-new"
          label="Kata sandi baru"
          value={form.password}
          onChange={(password) => setForm({ ...form, password })}
          error={errors.password}
          hint={`Minimal ${PASSWORD_MIN} karakter.`}
        />
        <PasswordField
          id="profile-password-confirm"
          label="Ulangi kata sandi baru"
          value={form.confirm}
          onChange={(confirm) => setForm({ ...form, confirm })}
          error={errors.confirm}
        />
      </div>
      <div className="flex justify-end border-t px-5 py-4">
        <Button type="submit" disabled={pending} className="h-12 max-sm:w-full md:h-10">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Ganti kata sandi
        </Button>
      </div>
    </form>
  )
}
