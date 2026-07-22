"use client"

import { createContext, useContext, useCallback } from "react"
import type { CurrencySettings } from "@/types/currency"
import { DEFAULT_CURRENCY_SETTINGS } from "@/types/currency"
import { formatCurrency, formatAxisTick } from "@/lib/format-currency"

interface CurrencyContextValue {
  settings: CurrencySettings
  /** Format a number using the company's currency settings */
  fmt: (amount: number) => string
  /** Always-compact format for chart axis labels (never full digits) */
  fmtAxis: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  settings: DEFAULT_CURRENCY_SETTINGS,
  fmt: (amount: number) => formatCurrency(amount, DEFAULT_CURRENCY_SETTINGS),
  fmtAxis: (amount: number) => formatAxisTick(amount, DEFAULT_CURRENCY_SETTINGS),
})

export function CurrencyProvider({
  children,
  settings,
}: {
  children: React.ReactNode
  settings: CurrencySettings
}) {
  const fmt = useCallback(
    (amount: number) => formatCurrency(amount, settings),
    [settings]
  )
  const fmtAxis = useCallback(
    (amount: number) => formatAxisTick(amount, settings),
    [settings]
  )

  return (
    <CurrencyContext.Provider value={{ settings, fmt, fmtAxis }}>
      {children}
    </CurrencyContext.Provider>
  )
}

/**
 * Hook to access currency formatting in client components.
 *
 * Usage:
 *   const { fmt } = useCurrency()
 *   return <span>{fmt(19500000000)}</span>  // "Rp 19.5B"
 */
export function useCurrency() {
  return useContext(CurrencyContext)
}
