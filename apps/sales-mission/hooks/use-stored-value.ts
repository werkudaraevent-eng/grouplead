"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * A string kept in this browser's localStorage, shared by every component
 * that reads the same key and updated in all of them at once (the columns
 * menu in the filter bar and the table under it).
 *
 * Storage can be missing or throw (a private window, blocked site data, a
 * sandboxed preview); the value then lives in memory for this visit, so
 * the page still works and simply forgets on reload. The server and the
 * first client render read null, so hydration always matches.
 */

const memory = new Map<string, string | null>()
const listeners = new Set<() => void>()

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function writeStoredValue(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
    memory.delete(key)
  } catch {
    memory.set(key, value)
  }
  listeners.forEach((listener) => listener())
}

export function useStoredValue(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  )
  const set = useCallback((next: string | null) => writeStoredValue(key, next), [key])
  return [value, set]
}
