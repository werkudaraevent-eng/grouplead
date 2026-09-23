"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/types/action-result"

interface PageData<Row> {
    rows: Row[]
    total: number
}

/**
 * One page of a server-paged list, fetched whenever the list's query or the
 * business unit changes. The previous page stays on screen while the next
 * one loads (`pending`), so the table dims rather than blinking to a
 * skeleton; the skeleton is for the very first load only. A slower, older
 * answer never overwrites a newer one.
 */
export function useListPage<Row>(
    load: (input: { query: string; scope: string | null }) => Promise<ActionResult<PageData<Row>>>,
    query: string,
    scope: string | null,
    errorMessage: string,
) {
    const [data, setData] = useState<PageData<Row> | null>(null)
    const [failed, setFailed] = useState(false)
    const [tick, setTick] = useState(0)
    // Which request the screen shows the answer to; pending while it is not the latest.
    const [settled, setSettled] = useState<string | null>(null)
    const key = `${scope ?? ""}|${query}|${tick}`
    const latest = useRef("")

    useEffect(() => {
        latest.current = key
        load({ query, scope })
            .then((result) => {
                if (key !== latest.current) return
                if (result.success && result.data) {
                    setData({ rows: result.data.rows, total: result.data.total })
                    setFailed(false)
                } else {
                    setFailed(true)
                    toast.error(result.error ? `${errorMessage}: ${result.error}` : errorMessage)
                }
            })
            .catch((error: unknown) => {
                if (key !== latest.current) return
                console.warn("[useListPage]", error)
                setFailed(true)
                toast.error(errorMessage)
            })
            .finally(() => {
                if (key === latest.current) setSettled(key)
            })
    }, [load, query, scope, key, errorMessage])
    const pending = settled !== key

    const reload = useCallback(() => setTick((n) => n + 1), [])

    return {
        rows: data?.rows ?? [],
        total: data?.total ?? 0,
        /** False until the first answer arrives. */
        loaded: data !== null,
        /** The latest request failed (the rows shown, if any, are the previous answer). */
        failed,
        pending,
        reload,
    }
}

/** The choices for a list's select filters, fetched once per business unit and after a change to the rows. */
export function useListOptions(
    load: (input: { scope: string | null }) => Promise<ActionResult<Record<string, string[]>>>,
    scope: string | null,
) {
    const [options, setOptions] = useState<Record<string, string[]>>({})
    const [tick, setTick] = useState(0)
    const latest = useRef("")

    useEffect(() => {
        const id = `${scope ?? ""}|${tick}`
        latest.current = id
        load({ scope })
            .then((result) => {
                if (id !== latest.current) return
                if (result.success && result.data) setOptions(result.data)
                // The filters still work without their choices; nothing to shout about.
                else console.warn("[useListOptions]", result.error)
            })
            .catch((error: unknown) => console.warn("[useListOptions]", error))
    }, [load, scope, tick])

    const reload = useCallback(() => setTick((n) => n + 1), [])
    return { options, reload }
}
