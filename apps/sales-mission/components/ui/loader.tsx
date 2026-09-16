import { cn } from "@/lib/utils"

/**
 * Loaders, from the 21st.dev "Loader" component, brought onto our tokens.
 * Twin of LeadEngine's components/ui/loader.tsx.
 *
 * The original spins a blue ring around a red one. Here the rings are the
 * brand's two colours (primary blue outside, accent amber inside), the same
 * pair the app launcher mark uses, so the loader reads as ours. Spinning is
 * `motion-safe` only: under reduced motion the rings stand still and the
 * text beside them carries the state (Material: an indicator is never the
 * only account of what is happening).
 */

const SIZES = {
  sm: { outer: "h-10 w-10 border-[3px]", inner: "h-7 w-7 border-[3px]" },
  md: { outer: "h-16 w-16 border-4", inner: "h-12 w-12 border-4" },
} as const

/** One ring, primary, 40dp. */
export function ClassicLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex h-10 w-10 items-center justify-center rounded-full border-4 border-primary border-t-transparent motion-safe:animate-spin", className)}
      aria-hidden="true"
    />
  )
}

/** Two rings, one inside the other, turning together. */
export default function ConcentricLoader({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  return (
    <div className={cn("flex items-center justify-center", className)} aria-hidden="true">
      <div className={cn("flex items-center justify-center rounded-full border-transparent border-t-primary motion-safe:animate-spin", s.outer)}>
        <div className={cn("flex items-center justify-center rounded-full border-transparent border-t-accent motion-safe:animate-spin", s.inner)} />
      </div>
    </div>
  )
}
