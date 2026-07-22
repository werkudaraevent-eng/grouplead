/** Currency display format: compact uses abbreviations (M/B/T), full shows all digits */
export type CurrencyFormat = 'compact' | 'full'

/** Currency prefix displayed before the number */
export type CurrencyPrefix = 'Rp' | 'IDR' | ''

/** Company-level currency display settings */
export interface CurrencySettings {
  currency_format: CurrencyFormat
  currency_prefix: CurrencyPrefix
}

/** Default settings used when no company settings exist */
export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  currency_format: 'compact',
  currency_prefix: 'Rp',
}
