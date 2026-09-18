"use client"

import { createContext, useContext, useState } from "react"

/**
 * Whether a phone's card list is in selection mode.
 *
 * On a desk a table shows a checkbox on every row; on a phone a permanent
 * checkbox column steals width from the name and makes the list read as a
 * form, so the checkboxes appear only once the person has said they want
 * to pick (a long press on a card, or "Pilih …" in the top bar's overflow
 * menu — Gmail, Google Files, Photos). The mode is entered from the shell's
 * menu and read by the list, which are siblings, hence the context. One
 * provider per list page (activities, prospects).
 */
interface SelectionMode {
  selecting: boolean
  setSelecting: (next: boolean) => void
}

const SelectionModeContext = createContext<SelectionMode | null>(null)

export function SelectionModeProvider({ children }: { children: React.ReactNode }) {
  const [selecting, setSelecting] = useState(false)
  return <SelectionModeContext.Provider value={{ selecting, setSelecting }}>{children}</SelectionModeContext.Provider>
}

/** The shared mode, or a local one where no provider wraps the list. */
export function useSelectionMode(): SelectionMode {
  const shared = useContext(SelectionModeContext)
  const [selecting, setSelecting] = useState(false)
  return shared ?? { selecting, setSelecting }
}
