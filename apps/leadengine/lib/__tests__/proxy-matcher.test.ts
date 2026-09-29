import { describe, expect, it } from "vitest"
import { config } from "@/proxy"

// The matcher is one path-to-regexp group, which reads as a plain regular
// expression anchored at both ends.
const runsProxy = (path: string) => config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path))

describe("proxy matcher", () => {
    it("lets the browser fetch the manifest, the icons and the favicon without a session", () => {
        // A manifest request carries no cookies; through the session check it
        // was redirected to /login and arrived as HTML.
        expect(runsProxy("/manifest.webmanifest")).toBe(false)
        expect(runsProxy("/icons/icon.svg")).toBe(false)
        expect(runsProxy("/icons/icon-192.png")).toBe(false)
        expect(runsProxy("/icons/apple-touch-icon.png")).toBe(false)
        expect(runsProxy("/icons/maskable-512.png")).toBe(false)
        expect(runsProxy("/favicon.ico")).toBe(false)
    })

    it("still checks the session on every page", () => {
        expect(runsProxy("/")).toBe(true)
        expect(runsProxy("/login")).toBe(true)
        expect(runsProxy("/contacts")).toBe(true)
        expect(runsProxy("/leads/123")).toBe(true)
        expect(runsProxy("/settings/ai")).toBe(true)
    })
})
