import type { CurrencySettings } from '@/types/currency'
import { DEFAULT_CURRENCY_SETTINGS } from '@/types/currency'

/**
 * Centralized currency formatter.
 *
 * This is the ONLY place currency formatting logic should live.
 * All components should use this (via the `useCurrency` hook or directly).
 *
 * @param amount  - The numeric value to format
 * @param settings - Currency display settings (from company_settings)
 * @returns Formatted string like "Rp 19.5B" or "IDR 19,500,000,000"
 */
export function formatCurrency(
  amount: number,
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): string {
  const prefix = settings.currency_prefix
    ? `${settings.currency_prefix} `
    : ''

  if (settings.currency_format === 'compact') {
    return formatCompact(amount, prefix)
  }
  return formatFull(amount, prefix)
}

/** Compact format: Rp 19.5B, Rp 130M, Rp 500K */
function formatCompact(amount: number, prefix: string): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (abs >= 1_000_000_000_000) return `${sign}${prefix}${(abs / 1_000_000_000_000).toFixed(1)}T`
  if (abs >= 1_000_000_000) return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(0)}M`
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${prefix}${abs.toLocaleString('id-ID')}`
}

/** Full format: Rp 19.500.000.000 (Indonesian locale, dot separators) */
function formatFull(amount: number, prefix: string): string {
  const formatted = Math.round(amount).toLocaleString('id-ID')
  return `${prefix}${formatted}`
}

/**
 * Always-compact formatter for chart axis labels.
 * Axis ticks should always be abbreviated regardless of user's format setting,
 * because full digits (e.g. "Rp 19.500.000.000") don't fit in axis width.
 * Respects the user's currency_prefix setting.
 */
export function formatAxisTick(
  amount: number,
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS
): string {
  const prefix = settings.currency_prefix
    ? `${settings.currency_prefix} `
    : ''
  return formatCompact(amount, prefix)
}
