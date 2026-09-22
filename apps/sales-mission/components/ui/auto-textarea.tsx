"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { enterAction } from "@/lib/ui/list-continuation"

/**
 * The app's long-text field: one textarea that grows with what is written.
 *
 * A fixed-height textarea makes a person compose into a well — three
 * sentences on a phone and the first one has sunk out of sight, so nobody
 * rereads what they wrote and the summary that feeds the CRM and the brief
 * gets shorter than it should be. Material's multi-line text field grows with
 * its content and offers no resize grip; the height is the content's job, not
 * a thing to drag. So: the box is `minRows` tall while it is empty, follows
 * the text line by line, and stops at `maxRows`, after which it scrolls inside
 * itself rather than pushing the send button off a phone screen.
 *
 * Nothing here scrolls the page. Growing the box keeps the caret in view by
 * itself, and `scrollIntoView` would drag the whole shell with it (see
 * `lib/ui/scroll-in-panel.ts`).
 */

/** The field's look: the one the app's textareas already had, minus the grip. */
export const AUTO_TEXTAREA_CLASS =
  "w-full resize-none rounded-md border border-input bg-field px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"

export interface AutoTextareaProps extends React.ComponentProps<"textarea"> {
  /** Height while the field is empty. Two for a short note, three for prose. */
  minRows?: number
  /** Where growing stops and the field scrolls inside itself instead. */
  maxRows?: number
  /** Carry a list marker to the next line on Enter. Off for templates. */
  lists?: boolean
}

/** A line's height in pixels, with a sane answer for `line-height: normal`. */
function lineHeightOf(style: CSSStyleDeclaration): number {
  const declared = Number.parseFloat(style.lineHeight)
  if (Number.isFinite(declared) && declared > 0) return declared
  const size = Number.parseFloat(style.fontSize)
  return Number.isFinite(size) && size > 0 ? size * 1.5 : 20
}

export function AutoTextarea({
  className,
  minRows = 3,
  maxRows = 14,
  lists = true,
  rows,
  ref,
  onKeyDown,
  onInput,
  ...props
}: AutoTextareaProps) {
  const inner = React.useRef<HTMLTextAreaElement | null>(null)
  const lastWidth = React.useRef(0)

  /** Hand the node to the caller's ref as well; some callers need the caret. */
  const attach = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  /**
   * Set the height to what the text needs, between the two bounds.
   *
   * Reset to `auto` first: `scrollHeight` reports the content's height only
   * while the box is not already holding it open, so measuring without the
   * reset would make the field grow and never shrink again.
   */
  const measure = React.useCallback(() => {
    const node = inner.current
    if (!node || typeof window === "undefined") return
    const style = window.getComputedStyle(node)
    const line = lineHeightOf(style)
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    const border = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth)
    const borderBox = style.boxSizing === "border-box"
    // `height` counts padding and border under border-box and neither under
    // content-box; `scrollHeight` always counts padding and never border.
    const frame = borderBox ? padding + border : 0
    node.style.height = "auto"
    const content = borderBox ? node.scrollHeight + border : node.scrollHeight - padding
    const ceiling = line * maxRows + frame
    node.style.height = `${Math.min(Math.max(content, line * minRows + frame), ceiling)}px`
    node.style.overflowY = content > ceiling ? "auto" : "hidden"
  }, [maxRows, minRows])

  // On mount, and whenever the value arrives from outside (a restored draft, a
  // placeholder inserted by a button): a render is the only warning we get.
  React.useLayoutEffect(measure, [measure, props.value, props.defaultValue])

  // The first paint may still be in the fallback font, which is a different
  // line height; remeasure once the real one is in.
  React.useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return
    let alive = true
    void document.fonts.ready.then(() => {
      if (alive) measure()
    })
    return () => {
      alive = false
    }
  }, [measure])

  // A narrower box wraps the same text into more lines. Width only: watching
  // our own height would answer the height we just set.
  React.useEffect(() => {
    const node = inner.current
    if (!node || typeof ResizeObserver === "undefined") return
    lastWidth.current = node.clientWidth
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === lastWidth.current) return
      lastWidth.current = node.clientWidth
      measure()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [measure])

  const handleInput: React.InputEventHandler<HTMLTextAreaElement> = (event) => {
    measure()
    onInput?.(event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (!lists || event.defaultPrevented || event.key !== "Enter") return
    if (event.nativeEvent.isComposing) return
    const node = event.currentTarget
    // A selection is a replacement, not a continuation; leave it to the browser.
    if (node.selectionStart !== node.selectionEnd) return
    const action = enterAction(node.value, node.selectionStart, event.shiftKey)
    if (action.kind === "plain") return
    // `setRangeText` writes past `maxLength`, which the browser would have
    // enforced on the keystroke; a marker must not be what breaks the limit.
    if (action.kind === "continue" && node.maxLength >= 0 && node.value.length + action.text.length > node.maxLength) return
    event.preventDefault()
    if (action.kind === "continue") {
      node.setRangeText(action.text, node.selectionStart, node.selectionEnd, "end")
    } else {
      node.setRangeText("", action.from, action.to, "end")
    }
    // `setRangeText` writes past the value setter React patched, so React's
    // own tracker is stale and this event reaches `onChange` as a real edit.
    node.dispatchEvent(new Event("input", { bubbles: true }))
  }

  return (
    <textarea
      data-slot="auto-textarea"
      ref={attach}
      rows={rows ?? minRows}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      className={cn(AUTO_TEXTAREA_CLASS, className)}
      {...props}
    />
  )
}
