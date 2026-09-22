/**
 * Marker logic for the list continuation in `AutoTextarea`.
 *
 * Reps already structure a summary by typing "1." and "2." by hand, so the
 * field keeps that structure going instead of making them retype the marker:
 * Enter at the end of an item opens the next one with the same marker, a
 * number counting on. Enter on an item nobody wrote anything in ends the list,
 * which is how every note-taking app (Keep, Apple Notes, Notion) gets out of
 * one without reaching for the mouse.
 *
 * The decision lives here, away from the DOM, so it can be read and tested on
 * its own; the component only turns a decision into a `setRangeText` call.
 */

/** A line's list marker, split from its indent and the text that follows. */
export interface LineMarker {
  /** Spaces or tabs before the marker. */
  indent: string
  /** The marker with its single trailing space: "- ", "* ", "• ", "3. ". */
  marker: string
  /** What was written after the marker on that line. */
  rest: string
}

/** Bullet or number, then a dot for a number, then exactly one space. */
const MARKER = /^([ \t]*)([-*•]|\d{1,9}\.) (.*)$/

/** The marker a line carries, or null when the line is not a list item. */
export function readMarker(line: string): LineMarker | null {
  const found = MARKER.exec(line)
  if (!found) return null
  return { indent: found[1], marker: `${found[2]} `, rest: found[3] }
}

/** The marker the next item carries: a number counts on, a bullet repeats. */
export function nextMarker(marker: string): string {
  const numbered = /^(\d{1,9})\. $/.exec(marker)
  if (!numbered) return marker
  return `${Number(numbered[1]) + 1}. `
}

/** An item that carries a marker and nothing else: the end of the list. */
export function isEmptyItem(line: string): boolean {
  const found = readMarker(line)
  return found !== null && found.rest.trim() === ""
}

/**
 * What pressing Enter should do.
 *
 * `plain` leaves it to the browser, which is the only correct answer for a
 * line that is not a list item and for Shift+Enter, where a person is asking
 * for a bare line break inside the item they are writing.
 */
export type EnterAction =
  /** Let the browser insert the newline. */
  | { kind: "plain" }
  /** Insert this text at the caret: newline, indent and the next marker. */
  | { kind: "continue"; text: string }
  /** Drop `value` between these two offsets: the marker of an empty item. */
  | { kind: "end"; from: number; to: number }

/** Where the line holding `caret` starts. */
function lineStartAt(value: string, caret: number): number {
  if (caret <= 0) return 0
  return value.lastIndexOf("\n", caret - 1) + 1
}

/** Where the line holding `caret` ends. */
function lineEndAt(value: string, caret: number): number {
  const breakAt = value.indexOf("\n", caret)
  return breakAt === -1 ? value.length : breakAt
}

/**
 * Decide what Enter does at `caret` in `value`.
 *
 * A caret still inside the marker is not yet writing an item, so it gets the
 * plain newline; a selection is left to the browser by the caller.
 */
export function enterAction(value: string, caret: number, shiftKey = false): EnterAction {
  if (shiftKey) return { kind: "plain" }
  const start = lineStartAt(value, caret)
  const line = value.slice(start, lineEndAt(value, caret))
  const found = readMarker(line)
  if (!found) return { kind: "plain" }
  const markerEnd = start + found.indent.length + found.marker.length
  if (caret < markerEnd) return { kind: "plain" }
  if (found.rest.trim() === "") return { kind: "end", from: start, to: markerEnd }
  return { kind: "continue", text: `\n${found.indent}${nextMarker(found.marker)}` }
}
