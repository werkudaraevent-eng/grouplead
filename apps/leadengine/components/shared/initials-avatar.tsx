import { cn } from "@/lib/utils"

/**
 * A tonal initials avatar with a stable hue per name, so the same person
 * or company is the same colour on every screen. Shows the image when one
 * exists. Tones are the tonal palettes the rest of the app already uses.
 */

const TONES = [
  "bg-primary/10 text-primary",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
]

export function getInitials(name: string): string {
  if (!name) return "?"
  // Letters and digits only: "Elitery (Data Sinergitama)" reads "ED", never "E(".
  const words = name.split(/\s+/).map((part) => part.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean)
  return words.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"
}

export function avatarTone(name: string): string {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) | 0
  return TONES[Math.abs(hash) % TONES.length]
}

const SIZES = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-xs",
  /** A company's tile on another record's card (40dp). */
  lg: "h-10 w-10 text-sm",
  /** A record's header on a desk (48dp). */
  header: "h-12 w-12 text-[17px]",
  /** A record's header on a phone (64dp). */
  hero: "h-16 w-16 text-[23px]",
} as const

/** A square's corners grow with it: 8dp small, 10dp at 40, 12dp at 48 and up (the record page's tiles). */
const SQUARE_RADIUS: Record<keyof typeof SIZES, string> = {
  xs: "rounded-md",
  sm: "rounded-md",
  md: "rounded-md",
  lg: "rounded-[10px]",
  header: "rounded-[12px]",
  hero: "rounded-[16px]",
}

export function InitialsAvatar({
  name,
  src,
  size = "sm",
  shape = "circle",
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  /** Circles for people, rounded squares for organisations. */
  shape?: "circle" | "square"
  className?: string
}) {
  const radius = shape === "circle" ? "rounded-full" : SQUARE_RADIUS[size]
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={cn("shrink-0 object-cover", SIZES[size], radius, className)} />
  }
  return (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center font-semibold", SIZES[size], radius, avatarTone(name), className)}>
      {getInitials(name)}
    </span>
  )
}
