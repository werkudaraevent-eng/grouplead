export const AZURE_SCOPES = "openid profile email"

export function resolveProviderDisplayName(metadata: Record<string, unknown>, fallback = "New User") {
  const fullName = [metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim()

  if (fullName) return fullName

  const givenName = typeof metadata.given_name === "string" ? metadata.given_name.trim() : ""
  const familyName = typeof metadata.family_name === "string" ? metadata.family_name.trim() : ""
  const combined = [givenName, familyName].filter(Boolean).join(" ")

  return combined || fallback
}
