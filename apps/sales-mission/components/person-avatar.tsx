import { cn } from "@/lib/utils"

/**
 * One avatar for every person shown in the app.
 *
 * The photo lives on `profiles.avatar_url`, set from LeadEngine's profile page.
 * Sales Mission used to draw initials everywhere and only the sidebar learned
 * to show the photo, so the same person had a face in the corner and two
 * letters in every list. One component means one answer to "what does a person
 * look like here".
 *
 * Initials are the fallback, not a design choice: a photo is shown wherever one
 * exists, and the ring of initials is what a person with none looks like.
 */
export function initialsOf(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?"
}

const SIZE_CLASS = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-9 w-9 text-sm",
} as const

export function PersonAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZE_CLASS
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted font-bold text-muted-foreground",
        SIZE_CLASS[size],
        className
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}
