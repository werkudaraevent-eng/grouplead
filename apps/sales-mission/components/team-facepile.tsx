import { PersonAvatar } from "@/components/person-avatar"
import { cn } from "@/lib/utils"

export interface FacepilePerson {
  name: string
  avatarUrl?: string | null
}

/**
 * Who is on it, as a card's supporting content: stacked avatars, the lead
 * first, then the lead's name and how many more.
 *
 * The bottom-start of a card is where M3 puts supporting content beside
 * the actions at bottom-end, and "these people → Join" is the pairing
 * Google Meet and Chat draw (Trello and Jira put the members there too).
 * The name is always written: most people have no photo and read as two
 * initials, so the face alone would say less than the old grey line did.
 * Nothing here is tappable; the card body is the one link.
 */
/**
 * "Setyorini Dewi Ismu Handayani" → "Setyorini D. I. H.": a card's footer
 * has one line beside the button, and a long name lost its ending to an
 * ellipsis. The first name reads as the person; the rest as initials.
 */
export function shortPersonName(name: string, max = 18): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  const [first, ...rest] = trimmed.split(/\s+/)
  const initials = rest.map((part) => `${part[0].toUpperCase()}.`).join(" ")
  return initials ? `${first} ${initials}` : first
}

export function TeamFacepile({
  people,
  max = 3,
  empty = "Belum ditugaskan",
  className,
}: {
  /** The lead first. */
  people: FacepilePerson[]
  max?: number
  /** What to say when nobody is on it. */
  empty?: string
  className?: string
}) {
  if (people.length === 0) {
    return <span className={cn("min-w-0 truncate text-xs text-muted-foreground", className)}>{empty}</span>
  }
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  const others = people.length - 1
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)} title={people.map((person) => person.name).join(", ")}>
      <span className="flex shrink-0 -space-x-2">
        {shown.map((person, index) => (
          <PersonAvatar key={`${person.name}-${index}`} name={person.name} avatarUrl={person.avatarUrl} size="sm" className="ring-2 ring-card" />
        ))}
        {rest > 0 && (
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-card">
            +{rest}
          </span>
        )}
      </span>
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{shortPersonName(people[0].name)}</span>
        {others > 0 && ` · +${others}`}
      </span>
    </span>
  )
}
