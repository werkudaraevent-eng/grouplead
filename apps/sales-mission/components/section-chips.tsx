"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export interface SectionChip {
  /** The id of the section element to scroll to. */
  id: string
  label: string
  /** Marks a section that still has a required field empty. */
  incomplete?: boolean
}

/**
 * A row of chips that names the sections of a long form and jumps to them.
 *
 * On a phone a seventeen-field form is four screens tall and the section
 * headings scroll away, so the rep loses where they are and where the
 * unfilled part is. This row sticks under the top app bar (Material's
 * scrolling secondary tabs), shows which section is in view, and marks the
 * ones the form still needs. From `lg` up the headings are in view and the
 * row is not rendered.
 */
export function SectionChips({ sections }: { sections: SectionChip[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null)
  const key = sections.map((section) => section.id).join("|")

  useEffect(() => {
    const scroller = document.getElementById("page-scroll")
    const elements = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))
    if (elements.length === 0) return
    // The section whose top has crossed the upper part of the viewport is
    // the current one; the margins keep the switch from flickering at the
    // edges.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { root: scroller, rootMargin: "-15% 0px -65% 0px", threshold: 0 }
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [key])

  const jump = (id: string) => {
    const element = document.getElementById(id)
    if (!element) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" })
    setActive(id)
  }

  if (sections.length < 2) return null

  return (
    <nav
      aria-label="Bagian formulir"
      className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background px-4 py-2 sm:-mx-6 sm:px-6 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sections.map((section) => {
        const current = active === section.id
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => jump(section.id)}
            aria-current={current ? "true" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors",
              current ? "border-primary bg-primary/10 text-primary" : "bg-card text-foreground hover:bg-muted"
            )}
          >
            {section.label}
            {section.incomplete && (
              <span
                role="img"
                aria-label="belum lengkap"
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--warning-foreground)]"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
