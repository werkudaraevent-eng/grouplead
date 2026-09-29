/**
 * Browser, system and kind of device from a user agent string, for the
 * Active devices list. Enough to tell "Chrome on Windows" from "Safari on
 * iPhone"; not a fingerprint and not a feature test.
 *
 * Hand-written rather than a dependency: the list needs about a dozen
 * browsers and systems, the popular parsers weigh 20 to 60 kB and are
 * updated for devices this workforce does not use. The rules are ordered
 * because the strings lie on purpose (every Chromium browser also says
 * "Chrome" and "Safari"; Edge and Opera are recognised first).
 *
 * Known limit: iPadOS Safari sends the Mac's string by default, so an iPad
 * reads as a Mac; nothing in the string tells them apart.
 *
 * Kept identical to `apps/sales-mission/lib/devices/user-agent.ts`.
 */

export type DeviceKind = "desktop" | "phone" | "tablet" | "unknown"

export interface ParsedUserAgent {
  /** "Chrome", "Safari", "Edge", …, or null when the string names none. */
  browser: string | null
  /** "Windows", "macOS", "iPhone", "iPad", "Android", "ChromeOS", "Linux", or null. */
  os: string | null
  kind: DeviceKind
}

const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOPiOS\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bInstagram\b/, "Instagram"],
  [/\bFBAN\/|\bFBAV\//, "Facebook"],
  [/\bLine\//, "LINE"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bCriOS\/|\b(?:Chrome|Chromium)\//, "Chrome"],
]

function detectOs(ua: string): Pick<ParsedUserAgent, "os" | "kind"> {
  if (/\biPad\b/.test(ua)) return { os: "iPad", kind: "tablet" }
  if (/\biPhone\b|\biPod\b/.test(ua)) return { os: "iPhone", kind: "phone" }
  if (/\bAndroid\b/.test(ua)) return { os: "Android", kind: /\bMobile\b/.test(ua) ? "phone" : "tablet" }
  if (/\bCrOS\b/.test(ua)) return { os: "ChromeOS", kind: "desktop" }
  if (/\bWindows\b|\bWin64\b/.test(ua)) return { os: "Windows", kind: "desktop" }
  if (/\bMacintosh\b|\bMac OS X\b/.test(ua)) return { os: "macOS", kind: "desktop" }
  if (/\bLinux\b|\bX11\b/.test(ua)) return { os: "Linux", kind: "desktop" }
  return { os: null, kind: "unknown" }
}

function detectBrowser(ua: string, os: string | null): string | null {
  for (const [pattern, name] of BROWSERS) {
    if (pattern.test(ua)) return name
  }
  // Safari says "Version/x Safari/y". A web app opened from an iPhone's home
  // screen drops both, but it is still Safari's engine and Safari's cookies.
  if (/\bVersion\/[\d.]+.*\bSafari\//.test(ua)) return "Safari"
  if ((os === "iPhone" || os === "iPad") && /\bAppleWebKit\//.test(ua)) return "Safari"
  return null
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = (userAgent ?? "").trim()
  if (!ua) return { browser: null, os: null, kind: "unknown" }
  const { os, kind } = detectOs(ua)
  return { browser: detectBrowser(ua, os), os, kind }
}
