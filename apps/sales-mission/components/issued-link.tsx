"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Check, Copy } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { paths } from "@/lib/paths"

/**
 * A link that exists exactly once.
 *
 * Only the hash is stored, so this is the single moment the plaintext is
 * readable. It is shown selected-on-focus with one copy button, and the way
 * back to it is stated plainly: there isn't one — revoke and make another.
 */
export function IssuedLink({ url, manageLink = true }: { url: string; manageLink?: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Blok tautannya lalu salin manual.")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="h-11 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
        <Button type="button" onClick={copy} className="h-11 shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
      {manageLink && (
        <p className="text-xs text-muted-foreground">
          Tautan ini tidak ditampilkan lagi setelah ditutup. Kalau hilang, cabut lalu buat baru di{" "}
          <Link href={paths.settings.board} className="font-semibold text-primary hover:underline">
            Pengaturan → Tautan publik
          </Link>
          .
        </p>
      )}
    </div>
  )
}
