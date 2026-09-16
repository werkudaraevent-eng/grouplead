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
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
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
} as const

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
  const radius = shape === "circle" ? "rounded-full" : "rounded-md"
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
