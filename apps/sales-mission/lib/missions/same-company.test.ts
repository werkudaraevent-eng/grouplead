import { describe, expect, it } from "vitest"
import { ilikeExact, sameCompanyFilter } from "./same-company"

/** What Postgres LIKE would do with the pattern once PostgREST has turned `*` into `%`. */
function likeMatches(pattern: string, text: string): boolean {
  const postgrest = pattern.replace(/\*/g, "%")
  let regex = ""
  for (let i = 0; i < postgrest.length; i++) {
    const char = postgrest[i]
    if (char === "\\" && i + 1 < postgrest.length) {
      regex += postgrest[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    } else if (char === "%") {
      regex += "[\\s\\S]*"
    } else if (char === "_") {
      regex += "[\\s\\S]"
    } else {
      regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
  }
  return new RegExp(`^${regex}$`, "i").test(text)
}

describe("sameCompanyFilter", () => {
  it("uses the CRM link when the activity has one", () => {
    expect(sameCompanyFilter({ clientCompanyId: "c0ffee00-0000-4000-8000-000000000001", clientCompanyName: "PT Arunika" })).toEqual({
      op: "eq",
      column: "client_company_id",
      value: "c0ffee00-0000-4000-8000-000000000001",
    })
  })

  it("matches an unlinked activity on the snapshot column, which is the one activities have", () => {
    const filter = sameCompanyFilter({ clientCompanyId: null, clientCompanyName: "  Bina Ruang Nusantara " })
    expect(filter).toEqual({ op: "ilike", column: "client_company_name_snapshot", value: "Bina Ruang Nusantara" })
  })
})

describe("ilikeExact", () => {
  it("leaves an ordinary name as it is, and matches it whatever the case", () => {
    expect(ilikeExact("PT Arunika Kreasi")).toBe("PT Arunika Kreasi")
    expect(likeMatches(ilikeExact("PT Arunika Kreasi"), "pt arunika kreasi")).toBe(true)
    expect(likeMatches(ilikeExact("PT Arunika Kreasi"), "PT Arunika Kreasi Nusantara")).toBe(false)
  })

  it("escapes the LIKE wildcards so they match only themselves", () => {
    expect(ilikeExact("100% Jaya")).toBe("100\\% Jaya")
    expect(ilikeExact("Kopi_Kita")).toBe("Kopi\\_Kita")
    expect(likeMatches(ilikeExact("100% Jaya"), "100% Jaya")).toBe(true)
    expect(likeMatches(ilikeExact("100% Jaya"), "100 persen Jaya")).toBe(false)
    expect(likeMatches(ilikeExact("Kopi_Kita"), "KopixKita")).toBe(false)
  })

  it("escapes the escape character itself", () => {
    expect(ilikeExact("A\\B")).toBe("A\\\\B")
    expect(likeMatches(ilikeExact("A\\B"), "A\\B")).toBe(true)
    expect(likeMatches(ilikeExact("A\\%"), "A\\anything")).toBe(false)
  })

  it("never lets a `*` become PostgREST's match-everything", () => {
    expect(ilikeExact("Bintang*Lima")).toBe("Bintang_Lima")
    expect(likeMatches(ilikeExact("Bintang*Lima"), "Bintang*Lima")).toBe(true)
    expect(likeMatches(ilikeExact("Bintang*Lima"), "Bintang Sembilan Lima")).toBe(false)
  })
})
