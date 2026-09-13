"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { retryCrmSync } from "@/app/actions/visit-report-actions"
import { Button } from "@/components/ui/button"

/**
 * Whether this visit's company and contacts reached LeadEngine.
 *
 * Three honest states. Synced, with when. Failed, with why and a retry, because
 * the failure was on the wire and the report itself is fine. Or not applicable,
 * because nobody was met and there was nothing to register. What it must not
 * do is imply the CRM knows about a visit it never heard of.
 */
export function CrmSyncStatus({
  missionId,
  syncedAt,
  error,
  reachesCrm,
  canRetry,
}: {
  missionId: string
  syncedAt: string | null
  error: string | null
  reachesCrm: boolean
  canRetry: boolean
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const retry = () => {
    start(async () => {
      const result = await retryCrmSync(missionId)
      if (result.success) toast.success("Perusahaan dan kontak terdaftar di LeadEngine.")
      else toast.error(result.error ?? "Gagal mendaftarkan ke LeadEngine.")
      router.refresh()
    })
  }

  if (!reachesCrm) {
    return (
      <p className="text-xs text-muted-foreground">
        Tidak ada yang ditemui, jadi tidak ada yang didaftarkan ke LeadEngine.
      </p>
    )
  }

  if (syncedAt) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-[var(--success-foreground)]">
        <Check className="h-3.5 w-3.5" />
        Perusahaan dan kontak terdaftar di LeadEngine.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="flex items-center gap-1.5 text-xs text-[var(--danger-foreground)]">
        <AlertCircle className="h-3.5 w-3.5" />
        Belum terdaftar di LeadEngine{error ? `: ${error}` : "."}
      </p>
      {canRetry && (
        <Button type="button" variant="outline" size="sm" onClick={retry} disabled={pending} className="h-9">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Coba lagi
        </Button>
      )}
    </div>
  )
}
