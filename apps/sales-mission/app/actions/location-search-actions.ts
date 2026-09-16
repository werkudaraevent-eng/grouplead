"use server"

import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { LeadEngineError, searchCities } from "@/lib/leadengine/client"

export interface LocationSuggestion {
  value: string
  country: string | null
}

export interface LocationSearchResult {
  locations: LocationSuggestion[]
  /** Set when LeadEngine could not be reached, so the UI can say why. */
  error: string | null
}

/**
 * Live search for the mission location field.
 *
 * A failure is returned as a message rather than thrown: location is optional
 * on a mission, so a provider outage must not stop a rep scheduling a visit.
 * They can type the area by hand and carry on.
 *
 * Held to the same grant as the form it serves. Behind this sits a metered
 * Google Places key, so an endpoint any signed-in account could call in a loop
 * is a billing problem as much as an access one.
 */
export async function searchLocations(query: string): Promise<LocationSearchResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { locations: [], error: "Sesi tidak valid." }
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { locations: [], error: "Anda tidak punya izin membuat aktivitas." }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) return { locations: [], error: null }

  try {
    const cities = await searchCities(trimmed)
    return {
      locations: cities.map((city) => ({ value: city.value, country: city.country ?? null })),
      error: null,
    }
  } catch (error) {
    return {
      locations: [],
      error:
        error instanceof LeadEngineError
          ? error.message
          : "Pencarian lokasi tidak tersedia saat ini.",
    }
  }
}
