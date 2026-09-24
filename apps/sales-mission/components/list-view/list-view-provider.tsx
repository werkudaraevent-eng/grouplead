"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { createListView, deleteListView, setListViewDefault, updateListView } from "@/app/actions/list-view-actions"
import { rememberView } from "@/components/remember-view"
import { useStoredValue, writeStoredValue } from "@/hooks/use-stored-value"
import type { ListCountFacts } from "@/lib/lists/list-count"
import { defaultColumnState, mergeColumnState, visibleColumns, type ColumnSpec, type ColumnState } from "@/lib/lists/list-columns"
import {
  DEFAULT_PAGE_SIZE,
  LIST_COLUMN_SPECS,
  currentViewConfig,
  defaultViewToApply,
  isPlainView,
  markedView,
  viewConfigKey,
  viewHref,
  type ListViewConfig,
  type SavedListKey,
  type SavedListView,
} from "@/lib/lists/list-views"

/**
 * One list's view: what its URL says, how many records it matches, which
 * columns it draws, and the person's saved views of it. Shared by the
 * filter bar (the "Tampilan" menu, the columns menu, the phone's count and
 * saved views) and the table (its columns, and the count at the leading
 * end of its footer), which are siblings on the page.
 *
 * The URL stays the source of truth for the query; this adds the columns
 * (kept per list in this browser) and the saved views (read by the page on
 * the server, written by the actions here, then re-read with a refresh).
 * Every change of the list's query, from the filter bar or from a view,
 * runs in the one transition here (`navigate`), so the count says
 * "Menyaring…" wherever it is drawn until the new list lands.
 * The rules are LeadEngine's: a bare open reopens the remembered view (the
 * page's redirect); a default view chooses the view only on the list's
 * first open in this browser (`fresh`); choosing a view writes its query
 * and size into the URL and its columns into the menu; and a view is
 * marked only when it is exactly what the screen shows.
 */

const columnsStorageKey = (list: SavedListKey) => `sa-list-columns-${list}`
const viewStorageKey = (list: SavedListKey) => `sa-list-view-${list}`

function parseStored(raw: string | null): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export interface ListViewState {
  list: SavedListKey
  specs: ColumnSpec[]
  /** The optional columns in order, as the menu shows them. */
  columns: ColumnState[]
  /** The columns the table draws: the locked name column, then the shown ones. */
  drawn: ColumnSpec[]
  setColumns: (next: ColumnState[]) => void
  resetColumns: () => void
  views: SavedListView[]
  /** False before the table's migration: views can be neither listed nor saved, and the "Tampilan" menu is not drawn. */
  available: boolean
  current: ListViewConfig
  /** The view that is exactly what the screen shows, if any. */
  marked: SavedListView | null
  /** The view the menu's actions act on: the marked one, else the one last chosen. */
  target: SavedListView | null
  /** The last chosen view no longer matches the screen: "Simpan perubahan" writes the screen into it. */
  dirty: boolean
  /** The screen is not the list's plain first view, so it is worth saving. */
  customised: boolean
  busy: boolean
  /** How many records the list matches, from the page (see lib/lists/list-count.ts). */
  count: ListCountFacts
  /** The list's next query is loading. */
  filtering: boolean
  /** Replace the list's URL inside the list's one transition. */
  navigate: (href: string) => void
  selectView: (view: SavedListView) => void
  /** "Tampilan awal": the list as it first opens, with no view chosen. */
  selectPlain: () => void
  saveAs: (name: string) => Promise<boolean>
  saveChanges: () => Promise<void>
  rename: (view: SavedListView, name: string) => Promise<boolean>
  toggleDefault: (view: SavedListView) => Promise<void>
  remove: (view: SavedListView) => Promise<void>
}

const ListViewContext = createContext<ListViewState | null>(null)

/** The list's view state, or null outside a list page (the filter frame then draws no view tools). */
export function useListView(): ListViewState | null {
  return useContext(ListViewContext)
}

/**
 * How the filter bar replaces the list's URL: through the provider's
 * transition, so the count follows it, or on its own outside a provider.
 */
export function useListNavigate(): (href: string) => void {
  const view = useContext(ListViewContext)
  const router = useRouter()
  const [, start] = useTransition()
  return view?.navigate ?? ((href: string) => start(() => router.replace(href, { scroll: false })))
}

/** The columns a list's table draws: the provider's, or the list's defaults where there is none. */
export function useDrawnColumns(list: SavedListKey): ColumnSpec[] {
  const view = useListView()
  if (view && view.list === list) return view.drawn
  const specs = LIST_COLUMN_SPECS[list]
  return visibleColumns(specs, defaultColumnState(specs))
}

export function ListViewProvider({
  list,
  views,
  available,
  fresh,
  count,
  children,
}: {
  list: SavedListKey
  views: SavedListView[]
  available: boolean
  /** A bare open with nothing remembered: the list's first open in this browser. */
  fresh: boolean
  /** Every match, the list with no facets, and whether anything narrows it. */
  count: ListCountFacts
  children: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const specs = LIST_COLUMN_SPECS[list]
  const [storedColumns, setStoredColumns] = useStoredValue(columnsStorageKey(list))
  const [storedViewId] = useStoredValue(viewStorageKey(list))
  const [filtering, startNavigation] = useTransition()
  const [busy, setBusy] = useState(false)

  const columns = useMemo(() => mergeColumnState(specs, parseStored(storedColumns)), [specs, storedColumns])
  const drawn = useMemo(() => visibleColumns(specs, columns), [specs, columns])
  const current = useMemo(() => currentViewConfig(list, search, columns), [list, search, columns])

  // The view this visit started on, or the default about to be applied:
  // changing the screen from there offers "Simpan perubahan" into it.
  const [chosenId, setChosenId] = useState<string | null>(
    () => defaultViewToApply(list, views, fresh, current)?.id ?? markedView(list, views, current)?.id ?? null,
  )

  const navigate = (href: string) => startNavigation(() => router.replace(href, { scroll: false }))

  // The remembered view is written first: a view whose address is the bare
  // list would otherwise be redirected back to the query being left.
  const open = (view: SavedListView) => {
    writeStoredValue(columnsStorageKey(list), JSON.stringify(view.config.columns))
    writeStoredValue(viewStorageKey(list), view.id)
    rememberView(list, view.config.query)
    navigate(viewHref(list, view.config))
  }

  // The default view, on the list's first open in this browser only.
  const appliedDefault = useRef(false)
  useEffect(() => {
    if (appliedDefault.current) return
    appliedDefault.current = true
    const target = defaultViewToApply(list, views, fresh, current)
    if (target) open(target)
    // Once, on mount: the default never overrides what the person does next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const marked = markedView(list, views, current, [chosenId, storedViewId])
  const chosen = views.find((view) => view.id === chosenId) ?? null
  const target = marked ?? chosen
  const dirty = !marked && chosen !== null && viewConfigKey(list, chosen.config) !== viewConfigKey(list, current)

  const run = async <T,>(work: () => Promise<T>): Promise<T> => {
    setBusy(true)
    try {
      return await work()
    } finally {
      setBusy(false)
    }
  }

  const state: ListViewState = {
    list,
    specs,
    columns,
    drawn,
    setColumns: (next) => setStoredColumns(JSON.stringify(next)),
    resetColumns: () => setStoredColumns(null),
    views,
    available,
    current,
    marked,
    target,
    dirty,
    customised: !isPlainView(list, current),
    busy,
    count,
    filtering,
    navigate,
    selectView: (view) => {
      setChosenId(view.id)
      open(view)
    },
    selectPlain: () => {
      setChosenId(null)
      writeStoredValue(viewStorageKey(list), null)
      setStoredColumns(null)
      rememberView(list, "")
      navigate(viewHref(list, { query: "", size: DEFAULT_PAGE_SIZE }))
    },
    saveAs: (name) =>
      run(async () => {
        const result = await createListView({ list, name, config: current })
        if (!result.success || !result.data) {
          toast.error(result.error ?? "Tampilan tidak bisa disimpan.")
          return false
        }
        setChosenId(result.data.id)
        writeStoredValue(viewStorageKey(list), result.data.id)
        toast.success(`Tampilan “${result.data.name}” disimpan`)
        router.refresh()
        return true
      }),
    saveChanges: () =>
      run(async () => {
        if (!chosen) return
        const result = await updateListView({ id: chosen.id, list, config: current })
        if (!result.success) {
          toast.error(result.error ?? "Perubahan tidak bisa disimpan.")
          return
        }
        toast.success(`Perubahan disimpan ke “${chosen.name}”`)
        router.refresh()
      }),
    rename: (view, name) =>
      run(async () => {
        const result = await updateListView({ id: view.id, list, name })
        if (!result.success) {
          toast.error(result.error ?? "Nama tidak bisa diubah.")
          return false
        }
        toast.success("Nama tampilan diubah")
        router.refresh()
        return true
      }),
    toggleDefault: (view) =>
      run(async () => {
        const result = await setListViewDefault({ id: view.id, list, isDefault: !view.isDefault })
        if (!result.success) {
          toast.error(result.error ?? "Tampilan bawaan tidak bisa diubah.")
          return
        }
        toast.success(view.isDefault ? `“${view.name}” bukan bawaan lagi` : `“${view.name}” jadi tampilan bawaan`)
        router.refresh()
      }),
    // A person's own shortcut, so no confirming dialog: the snackbar's
    // Batalkan saves it again, name, view and default included.
    remove: (view) =>
      run(async () => {
        const result = await deleteListView({ id: view.id, list })
        if (!result.success || !result.data) {
          toast.error(result.error ?? "Tampilan tidak bisa dihapus.")
          return
        }
        const removed = result.data
        if (chosenId === view.id) setChosenId(null)
        toast.success(`Tampilan “${removed.name}” dihapus`, {
          duration: 6000,
          action: {
            label: "Batalkan",
            onClick: async () => {
              const restored = await createListView({ list, name: removed.name, config: removed.config, isDefault: removed.isDefault })
              if (restored.success) router.refresh()
              else toast.error(restored.error ?? "Tampilan tidak bisa dikembalikan.")
            },
          },
        })
        router.refresh()
      }),
  }

  return <ListViewContext.Provider value={state}>{children}</ListViewContext.Provider>
}
