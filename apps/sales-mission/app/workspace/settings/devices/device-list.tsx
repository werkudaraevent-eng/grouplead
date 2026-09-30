"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Info, Laptop, Loader2, LogOut, MonitorSmartphone, RefreshCw, Smartphone, Tablet } from "@/components/icons"
import { signOutDevice, signOutOtherDevices } from "@/app/actions/device-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { DeviceView } from "@/lib/devices/device-display"
import type { DeviceKind } from "@/lib/devices/user-agent"
import { cn } from "@/lib/utils"

/**
 * Perangkat aktif: every device where this account is signed in, in Sales
 * Activity and LeadEngine alike (one sign-in covers both). This device
 * first, marked; each other one can be signed out on its own, or all of
 * them at once. Signing a device out cannot be undone from here (that
 * device has to sign in again), so it is confirmed, and the dialog says
 * what is lost there.
 */

const KIND_ICON: Record<DeviceKind, typeof Laptop> = {
  desktop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  unknown: MonitorSmartphone,
}

/** The danger role as a text button: M3's text button in the error colour. */
const DANGER_TEXT = "text-[var(--danger-foreground)] hover:bg-[var(--danger)] hover:text-[var(--danger-foreground)]"
const DANGER_FILLED = "bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90"

export function DeviceList({ devices, failed }: { devices: DeviceView[]; failed: boolean }) {
  const router = useRouter()
  const [target, setTarget] = useState<DeviceView | null>(null)
  const [pending, start] = useTransition()
  const others = devices.filter((device) => !device.isCurrent).length

  const confirm = () => {
    if (!target) return
    const name = target.name
    start(async () => {
      const result = await signOutDevice({ sessionId: target.sessionId })
      if (result.success) {
        toast.success(`${name} sudah dikeluarkan.`)
        setTarget(null)
        router.refresh()
      } else {
        toast.error(result.error ?? "Perangkat gagal dikeluarkan. Coba lagi.")
      }
    })
  }

  if (failed) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-card px-5 py-6 text-sm" role="alert">
          <p className="font-semibold text-foreground">Daftar perangkat tidak bisa dimuat sekarang.</p>
          <p className="mt-1 text-muted-foreground">Perangkatmu tetap masuk seperti biasa. Coba muat ulang sebentar lagi.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.refresh()}>
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </Button>
        </div>
        <FootNote />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {devices.length === 0 ? (
        <div className="rounded-xl border bg-card px-5 py-6 text-sm text-muted-foreground" role="status">
          Belum ada perangkat yang tercatat untuk akunmu. Perangkat muncul di sini setelah membuka Sales Activity atau Group Lead.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-label="Perangkat yang sedang masuk">
          {devices.map((device) => {
            const Icon = KIND_ICON[device.kind]
            return (
              <li key={device.sessionId} className="flex min-h-[72px] items-center gap-4 px-4 py-3 sm:px-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 break-words text-sm font-semibold text-foreground">{device.name}</span>
                    {device.isCurrent && (
                      <span className="inline-flex h-6 items-center rounded-md bg-[var(--success)] px-2 text-xs font-medium text-[var(--success-foreground)]">
                        Perangkat ini
                      </span>
                    )}
                  </p>
                  {device.meta && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{device.meta}</p>}
                </div>
                {!device.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("shrink-0 font-semibold", DANGER_TEXT)}
                    onClick={() => setTarget(device)}
                    aria-label={`Keluarkan ${device.name}`}
                  >
                    Keluarkan
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* On a phone the page action sits under the list, full width, where
          the thumb is; on a desk it is the header's (one door each). */}
      {others > 0 && (
        <div className="lg:hidden">
          <SignOutOthersButton count={others} className="w-full" />
        </div>
      )}

      <FootNote />

      <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !pending) setTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keluarkan {target?.name}?</DialogTitle>
            <DialogDescription>
              Perangkat itu langsung keluar dari Sales Activity dan Group Lead. Isian yang belum dikirim di sana akan hilang. Pemiliknya bisa masuk lagi dengan kata sandi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={pending}>Batal</Button>
            <Button onClick={confirm} disabled={pending} className={DANGER_FILLED}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Keluarkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FootNote() {
  return (
    <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Tidak kenal perangkatnya? Keluarkan, lalu ganti kata sandi. Perangkat yang tidak dipakai 30 hari keluar sendiri.
    </p>
  )
}

/** "Keluar dari semua perangkat lain", with its confirmation. The page's one action. */
export function SignOutOthersButton({ count, className }: { count: number; className?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  const confirm = () => {
    start(async () => {
      const result = await signOutOtherDevices()
      if (result.success) {
        const ended = result.data?.count ?? 0
        toast.success(ended > 0 ? `${ended} perangkat lain sudah dikeluarkan.` : "Tidak ada perangkat lain yang masih masuk.")
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Perangkat gagal dikeluarkan. Coba lagi.")
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        Keluar dari semua perangkat lain
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keluar dari {count} perangkat lain?</DialogTitle>
            <DialogDescription>
              Semua perangkat lain langsung keluar dari Sales Activity dan Group Lead; perangkat ini tetap masuk. Isian yang belum dikirim di sana akan hilang. Pemiliknya bisa masuk lagi dengan kata sandi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button onClick={confirm} disabled={pending} className={DANGER_FILLED}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Keluarkan semua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
