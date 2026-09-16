import { LayoutDashboard, MapPinned } from "@/components/icons"
import { cn } from "@/lib/utils"
import ConcentricLoader from "@/components/ui/loader"

/**
 * The screen shown between two Werkudara apps. Twin of Sales Mission's
 * components/app-transit.tsx; keep the two identical, because the whole
 * point is that the browser swaps documents behind a screen that does not
 * change. See that file for the reasoning.
 */

export type WerkudaraApp = "leadengine" | "sales-mission"

const APPS: Record<WerkudaraApp, { name: string; tagline: string; Icon: typeof LayoutDashboard }> = {
  leadengine: { name: "LeadEngine", tagline: "CRM dan operasional pipeline", Icon: LayoutDashboard },
  "sales-mission": { name: "Sales Activity", tagline: "Rencanakan aktivitas sales dan rekam hasilnya", Icon: MapPinned },
}

/** The indeterminate indicator of the transit screen: the brand's two rings. */
export function TransitLoader({ className }: { className?: string }) {
  return <ConcentricLoader size="md" className={className} />
}

export function AppTransit({ app, phase }: { app: WerkudaraApp; phase: "leaving" | "arriving" }) {
  const { name, tagline, Icon } = APPS[app]
  const status = phase === "leaving" ? `Membuka ${name}…` : `Memuat ${name}…`
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "app-transit flex items-center justify-center bg-background text-foreground",
        phase === "leaving" ? "fixed inset-0 z-[200]" : "min-h-screen"
      )}
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{tagline}</p>
        </div>
        <TransitLoader />
        <p className="text-sm text-muted-foreground">{status}</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Werkudara Group</p>
      </div>
    </div>
  )
}
