import { describe, expect, it } from "vitest"
import { resolveRememberedView, sanitizeViewString } from "./view-cookies"

describe("remembered view", () => {
    it("keeps what the list's parser accepts, without page or size", () => {
        expect(sanitizeViewString("contacts", "q=acme&owner=eq:Budi&page=3&size=100&evil=1")).toBe("q=acme&owner=eq%3ABudi")
        expect(sanitizeViewString("companies", "sector=eq:Hotel&sort=parent:desc")).toBe("sector=eq%3AHotel&sort=parent%3Adesc")
        expect(sanitizeViewString("companies", "company=eq:X")).toBe("")
    })

    it("a bare open with something remembered redirects to it", () => {
        expect(resolveRememberedView("contacts", {}, encodeURIComponent("q=acme&page=2"))).toEqual({ redirectTo: "/contacts?q=acme", fresh: false })
    })

    it("an open with a query is left alone", () => {
        expect(resolveRememberedView("contacts", { q: "x" }, "q=acme")).toEqual({ redirectTo: null, fresh: false })
    })

    it("an empty memory (after Clear all) opens the plain list", () => {
        expect(resolveRememberedView("companies", {}, "")).toEqual({ redirectTo: null, fresh: false })
    })

    it("no memory at all is a first open, when a default saved view may apply", () => {
        expect(resolveRememberedView("companies", {}, undefined)).toEqual({ redirectTo: null, fresh: true })
    })

    it("a cookie that cannot be decoded is still read through the parser, never thrown on", () => {
        const { redirectTo } = resolveRememberedView("contacts", {}, "q=%E0%A4%A&x=%zz")
        const url = new URL(redirectTo!, "https://crm.example")
        expect(url.pathname).toBe("/contacts")
        expect([...url.searchParams.keys()]).toEqual(["q"])
    })
})
