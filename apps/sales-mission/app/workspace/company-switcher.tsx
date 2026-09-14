"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Check, ChevronsUpDown, Loader2 } from "@/components/icons"
import { toast } from "sonner"
import { switchActiveCompany } from "@/app/actions/company-actions"
import type { CompanyOption } from "@/lib/sales-mission-access"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Sidebar header for a person who belongs to more than one business unit:
 * the current unit's name doubles as a menu of the others. One membership
 * means no menu; the name is just a label.
 */
export function CompanySwitcher({
  active,
  companies,
  className,
}: {
  active: CompanyOption
  companies: CompanyOption[]
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (companies.length < 2) {
    return <span className={cn("block truncate text-[11px] text-sidebar-foreground", className)}>{active.name}</span>
  }

  const choose = (slug: string) => {
    if (slug === active.slug) return
    startTransition(async () => {
      const result = await switchActiveCompany(slug)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "-ml-1 flex max-w-full items-center gap-1 rounded px-1 text-left text-[11px] text-sidebar-foreground hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
          aria-label={`Unit bisnis aktif: ${active.name}. Ganti unit`}
          disabled={pending}
        >
          <span className="truncate">{active.name}</span>
          {pending ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-70" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Unit bisnis</DropdownMenuLabel>
        {companies.map((company) => (
          <DropdownMenuItem key={company.slug} onSelect={() => choose(company.slug)} className="gap-2">
            <span className="flex-1 truncate">{company.name}</span>
            {company.slug === active.slug && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Button for the "this mission lives in another unit" card on the detail page. */
export function SwitchCompanyButton({ slug, label }: { slug: string; label: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      className="h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchActiveCompany(slug)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          router.refresh()
        })
      }
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </Button>
  )
}
