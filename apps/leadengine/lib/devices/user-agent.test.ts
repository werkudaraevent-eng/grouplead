import { describe, expect, it } from "vitest"
import { parseUserAgent } from "./user-agent"

const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.54",
  operaWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  homeScreenIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1",
  instagramIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.35.105 (iPhone14,5; iOS 17_0; id_ID)",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  chromeAndroidTablet: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  samsungAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
  safariIpad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  chromeOs: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0",
}

describe("parseUserAgent", () => {
  it.each([
    ["chromeWindows", "Chrome", "Windows", "desktop"],
    ["edgeWindows", "Edge", "Windows", "desktop"],
    ["operaWindows", "Opera", "Windows", "desktop"],
    ["safariIphone", "Safari", "iPhone", "phone"],
    ["homeScreenIphone", "Safari", "iPhone", "phone"],
    ["chromeIphone", "Chrome", "iPhone", "phone"],
    ["instagramIphone", "Instagram", "iPhone", "phone"],
    ["chromeAndroid", "Chrome", "Android", "phone"],
    ["chromeAndroidTablet", "Chrome", "Android", "tablet"],
    ["samsungAndroid", "Samsung Internet", "Android", "phone"],
    ["firefoxMac", "Firefox", "macOS", "desktop"],
    ["safariMac", "Safari", "macOS", "desktop"],
    ["safariIpad", "Safari", "iPad", "tablet"],
    ["chromeOs", "Chrome", "ChromeOS", "desktop"],
    ["firefoxLinux", "Firefox", "Linux", "desktop"],
  ] as const)("%s reads as %s on %s (%s)", (key, browser, os, kind) => {
    expect(parseUserAgent(UA[key])).toEqual({ browser, os, kind })
  })

  it("knows nothing from nothing, or from a server's own agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null, kind: "unknown" })
    expect(parseUserAgent("   ")).toEqual({ browser: null, os: null, kind: "unknown" })
    expect(parseUserAgent("node")).toEqual({ browser: null, os: null, kind: "unknown" })
  })
})
