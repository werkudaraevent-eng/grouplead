"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { pickActiveSection, sectionScrollTop, spyRootMargin } from "@/lib/ui/record-sections"

/** The shell's scroller: every page scrolls in `<main>`, never the window. */
function mainScroller(): HTMLElement | null {
    return document.getElementById("main-content")
}

/**
 * Which of a page's sections is being read, and a jump to any of them: a
 * record page's related-list rail (Zoho CRM) and its phone chip row.
 *
 * An IntersectionObserver watches a band from just under the pinned bars
 * (`getPinned()`, the header row and tabs as they stand) to 40% of the
 * scroller's height; the first section crossing it is the one marked. A
 * second one watches `endId`, an empty element after the last section: at
 * the end of a page that scrolled, the last section is marked even when it
 * is too short to reach the band.
 *
 * A jump sets `scrollTop` on the shell's scroller (`<main id=
 * "main-content">`), never `scrollIntoView`, which slides every ancestor,
 * and moves focus to the section with `preventScroll`, for the keyboard and
 * a screen reader. The jumped-to section stays marked while the page
 * travels there, until the scroll ends or the reader scrolls themselves.
 */
export function useSectionSpy({
    ids,
    endId,
    getPinned,
    enabled = true,
}: {
    /** The sections' element ids, in page order. */
    ids: readonly string[]
    /** An empty element after the last section. */
    endId?: string
    /** The height of what is pinned over the scroller's top. */
    getPinned: () => number
    enabled?: boolean
}): { active: string; jumpTo: (id: string) => void } {
    const [active, setActive] = useState(ids[0] ?? "")
    const inBand = useRef(new Set<string>())
    const atEnd = useRef(false)
    const lock = useRef<string | null>(null)
    const releaseLock = useRef<(() => void) | null>(null)
    const pinnedRef = useRef(getPinned)
    useEffect(() => {
        pinnedRef.current = getPinned
    })
    const key = ids.join("|")

    useEffect(() => {
        if (!enabled) return
        const root = mainScroller()
        if (!root) return
        const order = key.split("|")
        const sections = order.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el)
        const end = endId ? document.getElementById(endId) : null

        const decide = () => {
            if (lock.current) return
            // "At the end" only once the page has scrolled: a page that fits
            // the window shows its end at rest, and still opens on the first.
            const next = pickActiveSection(order, inBand.current, atEnd.current && root.scrollTop > 0)
            if (next) setActive(next)
        }

        let band: IntersectionObserver | null = null
        let lastMargin = ""
        const observeBand = () => {
            const margin = spyRootMargin(pinnedRef.current(), root.clientHeight)
            if (margin === lastMargin && band) return
            lastMargin = margin
            band?.disconnect()
            inBand.current = new Set()
            band = new IntersectionObserver(
                (entries) => {
                    for (const entry of entries) {
                        const id = (entry.target as HTMLElement).id
                        if (entry.isIntersecting) inBand.current.add(id)
                        else inBand.current.delete(id)
                    }
                    decide()
                },
                { root, rootMargin: margin, threshold: 0 },
            )
            for (const section of sections) band.observe(section)
        }
        observeBand()

        const endWatch = end
            ? new IntersectionObserver(
                  ([entry]) => {
                      atEnd.current = entry.isIntersecting
                      decide()
                  },
                  { root, threshold: 0 },
              )
            : null
        if (end && endWatch) endWatch.observe(end)

        // The band follows the window: a new height, or the header row
        // appearing or going at `lg`, moves where it sits.
        const resize = new ResizeObserver(() => observeBand())
        resize.observe(root)

        return () => {
            band?.disconnect()
            endWatch?.disconnect()
            resize.disconnect()
        }
    }, [enabled, key, endId])

    useEffect(() => () => releaseLock.current?.(), [])

    const jumpTo = useCallback((id: string) => {
        const root = mainScroller()
        const section = document.getElementById(id)
        if (!root || !section) return
        releaseLock.current?.()
        setActive(id)
        lock.current = id

        const top = sectionScrollTop({
            scrollTop: root.scrollTop,
            sectionTop: section.getBoundingClientRect().top,
            scrollerTop: root.getBoundingClientRect().top,
            pinned: pinnedRef.current(),
            maxScrollTop: root.scrollHeight - root.clientHeight,
        })

        const takeover = ["wheel", "touchstart", "keydown"] as const
        let timer = 0
        const release = () => {
            lock.current = null
            window.clearTimeout(timer)
            root.removeEventListener("scrollend", release)
            for (const type of takeover) root.removeEventListener(type, release)
            releaseLock.current = null
        }
        releaseLock.current = release
        root.addEventListener("scrollend", release)
        for (const type of takeover) root.addEventListener(type, release, { passive: true })
        // Where `scrollend` is not supported, the lock lets go on its own.
        timer = window.setTimeout(release, 1000)

        if (Math.abs(root.scrollTop - top) < 1) release()
        else {
            const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            root.scrollTo({ top, behavior: smooth ? "smooth" : "auto" })
        }
        section.focus({ preventScroll: true })
    }, [])

    return { active, jumpTo }
}
