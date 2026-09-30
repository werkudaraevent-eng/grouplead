import { AppIcon, type WerkudaraApp } from "@/components/app-icon"
import { cn } from "@/lib/utils"
import ConcentricLoader from "@/components/ui/loader"

/**
 * The screen shown between two Werkudara apps.
 *
 * Switching apps is a full document navigation to another origin, so there
 * is nothing to stream: the old page can only cover itself, and the new
 * origin can only paint what its first HTML carries. This one component is
 * rendered by both, identically (its twin lives in LeadEngine at
 * components/layout/app-transit.tsx), so the moment the browser swaps the
 * documents the user sees the same screen they were already looking at.
 * Slack's workspace switch and Google's app launcher work the same way: a
 * branded screen that says where you are going, then the shell fades in.
 *
 * Two phases. "leaving" is an overlay on the page being left, mounted the
 * instant the row is clicked. "arriving" is the destination's root
 * loading.tsx, drawn while its layout resolves the session. Material's
 * fade-through pattern: the old content fades, the new one arrives.
 *
 * The indicator is circular and indeterminate (a wait of unknown length,
 * for one whole screen). Under reduced motion it stands still and the
 * sentence carries the state.
 */

export type { WerkudaraApp }

/** The name each app has on screen; the CRM's code still says "leadengine". */
const APPS: Record<WerkudaraApp, { name: string; tagline: string }> = {
  leadengine: { name: "Group Lead", tagline: "CRM dan operasional pipeline" },
  "sales-mission": { name: "Sales Activity", tagline: "Rencanakan aktivitas sales dan rekam hasilnya" },
}

/** The indeterminate indicator of the transit screen: the brand's two rings. */
export function TransitLoader({ className }: { className?: string }) {
  return <ConcentricLoader size="md" className={className} />
}

export function AppTransit({ app, phase }: { app: WerkudaraApp; phase: "leaving" | "arriving" }) {
  const { name, tagline } = APPS[app]
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
        {/* The family icon, as on the home screen and in the drawer. */}
        <AppIcon app={app} className="h-14 w-14" strokeWidth={2} />
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
