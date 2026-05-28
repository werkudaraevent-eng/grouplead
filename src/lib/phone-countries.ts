/**
 * Common phone-number countries with their ISO codes, dial codes, flag
 * emoji, and display name. Ordered by population / business relevance
 * for an Indonesian B2B CRM.
 *
 * Used by the country-aware <PhoneInput>. For a fuller list, swap to
 * `libphonenumber-js/metadata.full.json`. This curated list keeps the
 * dropdown manageable and fast.
 */

import type { CountryCode } from "libphonenumber-js"

export interface PhoneCountry {
    code: CountryCode
    name: string
    dialCode: string
    /** Flag emoji for the country. */
    flag: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: "ID", name: "Indonesia", dialCode: "62", flag: "🇮🇩" },
    { code: "SG", name: "Singapore", dialCode: "65", flag: "🇸🇬" },
    { code: "MY", name: "Malaysia", dialCode: "60", flag: "🇲🇾" },
    { code: "TH", name: "Thailand", dialCode: "66", flag: "🇹🇭" },
    { code: "PH", name: "Philippines", dialCode: "63", flag: "🇵🇭" },
    { code: "VN", name: "Vietnam", dialCode: "84", flag: "🇻🇳" },
    { code: "CN", name: "China", dialCode: "86", flag: "🇨🇳" },
    { code: "HK", name: "Hong Kong", dialCode: "852", flag: "🇭🇰" },
    { code: "TW", name: "Taiwan", dialCode: "886", flag: "🇹🇼" },
    { code: "JP", name: "Japan", dialCode: "81", flag: "🇯🇵" },
    { code: "KR", name: "South Korea", dialCode: "82", flag: "🇰🇷" },
    { code: "IN", name: "India", dialCode: "91", flag: "🇮🇳" },
    { code: "AU", name: "Australia", dialCode: "61", flag: "🇦🇺" },
    { code: "NZ", name: "New Zealand", dialCode: "64", flag: "🇳🇿" },
    { code: "US", name: "United States", dialCode: "1", flag: "🇺🇸" },
    { code: "CA", name: "Canada", dialCode: "1", flag: "🇨🇦" },
    { code: "GB", name: "United Kingdom", dialCode: "44", flag: "🇬🇧" },
    { code: "DE", name: "Germany", dialCode: "49", flag: "🇩🇪" },
    { code: "FR", name: "France", dialCode: "33", flag: "🇫🇷" },
    { code: "NL", name: "Netherlands", dialCode: "31", flag: "🇳🇱" },
    { code: "AE", name: "United Arab Emirates", dialCode: "971", flag: "🇦🇪" },
    { code: "SA", name: "Saudi Arabia", dialCode: "966", flag: "🇸🇦" },
    { code: "QA", name: "Qatar", dialCode: "974", flag: "🇶🇦" },
    { code: "TR", name: "Turkey", dialCode: "90", flag: "🇹🇷" },
    { code: "ZA", name: "South Africa", dialCode: "27", flag: "🇿🇦" },
    { code: "BR", name: "Brazil", dialCode: "55", flag: "🇧🇷" },
    { code: "MX", name: "Mexico", dialCode: "52", flag: "🇲🇽" },
]

const COUNTRY_BY_CODE: Map<CountryCode, PhoneCountry> = new Map(
    PHONE_COUNTRIES.map((c) => [c.code, c]),
)

export function getCountryByCode(code: CountryCode): PhoneCountry | undefined {
    return COUNTRY_BY_CODE.get(code)
}

/**
 * Detect country from a string starting with `+` or country dial code.
 * Returns the matching `PhoneCountry` or `undefined` if no match.
 *
 * Greedy match: tries longest dial codes first so `+1809` (Dominican
 * Republic) won't accidentally resolve to US (`+1`) for codes we list.
 */
export function detectCountryFromE164(value: string): PhoneCountry | undefined {
    if (!value) return undefined
    const v = value.startsWith("+") ? value.slice(1) : value
    // Sort by dial code length DESC so longer codes match first.
    const sorted = [...PHONE_COUNTRIES].sort(
        (a, b) => b.dialCode.length - a.dialCode.length,
    )
    return sorted.find((c) => v.startsWith(c.dialCode))
}
