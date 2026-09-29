"use client"

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import {
  FORM_DRAFT_PREFIX,
  FORM_DRAFT_SAVE_DELAY_MS,
  formDraftKey,
  formValuesFromEntries,
  parseFormDraft,
  serializeFormDraft,
  staleFormDraftKeys,
  type FormValues,
} from "@/lib/drafts/form-draft"

/**
 * A form's draft in this browser (DESIGN.md, "Surviving a deploy"): written
 * while the person types, offered back when the form opens again, removed
 * when it is sent. The rules are `lib/drafts/form-draft.ts`; this is the
 * part that touches localStorage and React.
 *
 * Storage can be missing or throw (a private window, a full quota); the
 * form then works as it always did, without a draft.
 */

const OwnerContext = createContext<string | null>(null)

/** Whose drafts these are: the signed-in person, set once by the workspace shell. */
export function DraftOwnerProvider({ owner, children }: { owner: string | null; children: ReactNode }) {
  return createElement(OwnerContext.Provider, { value: owner }, children)
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Full or blocked: the form still works, only without its draft.
  }
}

function removeRaw(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to do.
  }
}

type Opened = { values: unknown; savedAt: number } | null

/**
 * What storage held for a key when one form first asked, kept for the life
 * of that form: the draft offered back is the one it opened on, never the
 * copy it has been writing since. Per form instance, so opening the form
 * again reads storage again.
 */
const openedByForm = new WeakMap<object, Map<string, Opened>>()

function openedDraft(form: object, key: string | null): Opened {
  if (!key) return null
  let byKey = openedByForm.get(form)
  if (!byKey) {
    byKey = new Map()
    openedByForm.set(form, byKey)
  }
  if (!byKey.has(key)) byKey.set(key, parseFormDraft(readRaw(key), Date.now()))
  return byKey.get(key) ?? null
}

const neverChanges = () => () => {}

let pruned = false

/** Once per page load: expired and unreadable drafts go, so storage never fills with old forms. */
function pruneOnce(now: number) {
  if (pruned) return
  pruned = true
  try {
    const store = window.localStorage
    const entries: Array<[string, string | null]> = []
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index)
      if (key?.startsWith(FORM_DRAFT_PREFIX)) entries.push([key, store.getItem(key)])
    }
    for (const key of staleFormDraftKeys(entries, now)) removeRaw(key)
  } catch {
    // Storage blocked: nothing was written either.
  }
}

export interface FormDraft<T> {
  /** What this browser still held for the form when it opened; null once discarded. */
  restored: T | null
  /** Whether "Isian yang belum terkirim dikembalikan." is up. */
  noticeOpen: boolean
  /** Tutup: the notice goes, the answers stay and keep being saved. */
  dismiss: () => void
  /** Buang: the stored draft goes; the form puts its fresh answers back. */
  discard: () => void
  /** Sent: the draft goes, and these same answers are not written back. */
  clear: () => void
  /** Written at once rather than after the pause, for the moment a send starts. */
  saveNow: (value: T) => void
}

/**
 * The draft of one form for one record.
 *
 * `value` is the form's answers as they stand, `changed` whether they
 * differ from the fresh form (only then is anything written; putting every
 * answer back removes the draft). `ready` holds writing back until the form
 * knows what "fresh" is. The draft is read once per opening of the form,
 * and never during hydration, so the first render matches the server's.
 */
export function useFormDraft<T>({
  form,
  record,
  value,
  changed,
  ready = true,
  enabled = true,
  keepRestored = true,
}: {
  form: string
  record: string
  value: T
  changed: boolean
  ready?: boolean
  enabled?: boolean
  /**
   * Whether a draft given back counts as changed until it is sent or thrown
   * away. Off for a form whose `changed` already says exactly what the
   * browser must hold (the report: whatever its server draft lacks).
   */
  keepRestored?: boolean
}): FormDraft<T> {
  const owner = useContext(OwnerContext)
  const key = enabled ? formDraftKey(owner, form, record) : null
  const [instance] = useState(() => ({}))
  const opened = useSyncExternalStore(neverChanges, () => openedDraft(instance, key), () => null)
  // Each for the draft it concerned: the notice closed (Tutup, or sent), the
  // draft thrown away (Buang), and the draft finished with (sent or thrown away).
  const [closedFor, setClosedFor] = useState<Opened>(null)
  const [discardedFor, setDiscardedFor] = useState<Opened>(null)
  const [settledFor, setSettledFor] = useState<Opened>(null)
  const live = opened !== null && opened !== discardedFor ? opened : null
  const restored = live ? (live.values as T) : null
  const noticeOpen = live !== null && live !== closedFor
  // A draft that was given back stays a draft until it is sent or thrown
  // away, even where it matches the fresh form.
  const keep = changed || (keepRestored && live !== null && live !== settledFor)
  const json = JSON.stringify(value) ?? "null"

  const readFor = useRef<string | null>(null)
  const seen = useRef<string | null>(null)
  const heldBack = useRef<string | null>(null)
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; key: string; value: T } | null>(null)

  const cancel = useCallback(() => {
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = null
  }, [])

  const flush = useCallback(() => {
    const job = pending.current
    if (!job) return
    clearTimeout(job.timer)
    pending.current = null
    writeRaw(job.key, serializeFormDraft(job.value, Date.now()))
  }, [])

  // Once per key: old drafts go, and writing starts from what the form shows now.
  useEffect(() => {
    if (!key) return
    pruneOnce(Date.now())
    readFor.current = key
    seen.current = null
    heldBack.current = null
    return () => {
      flush()
      readFor.current = null
    }
  }, [key, flush])

  // Write as the answers change; remove when they are back to the fresh form.
  useEffect(() => {
    if (!key || readFor.current !== key || !ready) return
    // The first answers seen are the form opening, not the person typing.
    if (seen.current === null) {
      seen.current = json
      return
    }
    const moved = json !== seen.current
    seen.current = json
    if (heldBack.current !== null) {
      if (json === heldBack.current) return
      heldBack.current = null
    }
    if (!keep) {
      cancel()
      removeRaw(key)
      return
    }
    if (!moved) return
    cancel()
    const snapshot = JSON.parse(json) as T
    pending.current = {
      key,
      value: snapshot,
      timer: setTimeout(() => {
        pending.current = null
        writeRaw(key, serializeFormDraft(snapshot, Date.now()))
      }, FORM_DRAFT_SAVE_DELAY_MS),
    }
  }, [key, json, keep, ready, cancel])

  // Leaving the page (a reload, a closed tab, the phone putting the browser away) writes what is pending.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [flush])

  const dismiss = useCallback(() => setClosedFor(live), [live])

  const discard = useCallback(() => {
    cancel()
    if (key) removeRaw(key)
    seen.current = null
    setDiscardedFor(live)
    setSettledFor(live)
  }, [cancel, key, live])

  const clear = useCallback(() => {
    cancel()
    if (key) removeRaw(key)
    // The answers last seen are the ones just sent; they are not written back.
    heldBack.current = seen.current
    setClosedFor(live)
    setSettledFor(live)
  }, [cancel, key, live])

  const saveNow = useCallback(
    (next: T) => {
      if (!key) return
      cancel()
      writeRaw(key, serializeFormDraft(next, Date.now()))
    },
    [cancel, key]
  )

  return { restored, noticeOpen, dismiss, discard, clear, saveNow }
}

/**
 * A posting form's answers as they stand, for a form whose inputs are
 * partly uncontrolled: read from the form itself after anything that can
 * change an answer (typing, a pick, a tap on a chip or a calendar slot),
 * a moment later so the pickers' hidden inputs have caught up, and at once
 * when it is sent.
 *
 * It also keeps the form from wiping itself. React resets a form's
 * uncontrolled fields after every `<form action>` submission, failed or
 * not; these forms leave the page when they succeed, so a reset only ever
 * erased answers after a failure, which is the moment they matter most.
 */
export function useFormCapture(
  form: HTMLFormElement | null,
  onCapture: (values: FormValues, reason: "open" | "edit" | "submit") => void,
  skip?: (name: string) => boolean
) {
  const latest = useRef(onCapture)
  const skipRef = useRef(skip)
  useEffect(() => {
    latest.current = onCapture
    skipRef.current = skip
  })

  useEffect(() => {
    if (!form) return
    const read = () => formValuesFromEntries(new FormData(form).entries(), skipRef.current)
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(() => latest.current(read(), "edit"), 150)
    }
    const onSubmit = () => {
      clearTimeout(timer)
      latest.current(read(), "submit")
    }
    const onReset = (event: Event) => event.preventDefault()
    latest.current(read(), "open")
    const events = ["input", "change", "click", "keyup"] as const
    for (const name of events) form.addEventListener(name, soon)
    form.addEventListener("submit", onSubmit)
    form.addEventListener("reset", onReset)
    return () => {
      clearTimeout(timer)
      for (const name of events) form.removeEventListener(name, soon)
      form.removeEventListener("submit", onSubmit)
      form.removeEventListener("reset", onReset)
    }
  }, [form])
}
