/**
 * Where a request came from, as Vercel's edge saw it, for Perangkat aktif's
 * "Jakarta · 2 jam lalu". Vercel sets `x-vercel-ip-city` (URL-encoded, so
 * "S%C3%A3o%20Paulo") and `x-vercel-ip-country` (ISO 3166-1 alpha-2) on
 * every request it serves; locally neither exists and both read as null.
 * Nothing more precise is kept: a city is enough to recognise one's own
 * laptop and to notice one that is not.
 *
 * Kept in step with `apps/leadengine/lib/devices/geo-headers.ts`.
 */

export interface RequestPlace {
  city: string | null
  country: string | null
}

export function readRequestPlace(get: (name: string) => string | null | undefined): RequestPlace {
  const rawCity = get("x-vercel-ip-city")?.trim()
  let city: string | null = null
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity)
    } catch {
      city = rawCity
    }
    city = city.trim().slice(0, 120) || null
  }
  const rawCountry = get("x-vercel-ip-country")?.trim()
  const country = rawCountry && /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null
  return { city, country }
}
