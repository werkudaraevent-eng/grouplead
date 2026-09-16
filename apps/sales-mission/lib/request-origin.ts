import { headers } from "next/headers"

/**
 * The origin the person is actually using, from the request rather than a
 * hardcoded host, so a copied link works in preview and local environments
 * as well as production. Same derivation as the board link settings.
 */
export async function requestOrigin(): Promise<{ origin: string; host: string }> {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001"
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return { origin: `${proto}://${host}`, host: host.split(":")[0] }
}
