import { describe, expect, it } from "vitest"
import { loginPathFor, safeNextPath } from "./next-path"

const FILE_LINK = "/workspace/lampiran?jenis=foto&berkas=11111111-1111-4111-8111-111111111111/report/22222222-2222-4222-8222-222222222222.jpg"

describe("safeNextPath", () => {
  it("keeps a workspace path with its query and fragment", () => {
    expect(safeNextPath("/workspace")).toBe("/workspace")
    expect(safeNextPath("/workspace/activities/abc?fokus=laporan")).toBe("/workspace/activities/abc?fokus=laporan")
    expect(safeNextPath("/workspace/panduan#laporan")).toBe("/workspace/panduan#laporan")
    expect(safeNextPath(FILE_LINK)).toBe(FILE_LINK)
    // The server hands the proxy the query with the path's slashes encoded; kept as it came.
    const encoded = FILE_LINK.replaceAll("/report/", "%2Freport%2F")
    expect(safeNextPath(encoded)).toBe(encoded)
  })

  it("refuses anything that could leave this origin", () => {
    expect(safeNextPath("https://evil.example/workspace")).toBeNull()
    expect(safeNextPath("//evil.example/workspace")).toBeNull()
    expect(safeNextPath("/\\evil.example")).toBeNull()
    expect(safeNextPath("/\\/evil.example")).toBeNull()
    expect(safeNextPath("\\\\evil.example")).toBeNull()
    expect(safeNextPath("/\t/evil.example")).toBeNull()
    expect(safeNextPath("/\n/evil.example")).toBeNull()
    expect(safeNextPath("javascript:alert(1)")).toBeNull()
    expect(safeNextPath("workspace")).toBeNull()
    expect(safeNextPath(" /workspace")).toBeNull()
  })

  it("refuses a path outside the workspace, the login page included, so sign-in never loops", () => {
    expect(safeNextPath("/")).toBeNull()
    expect(safeNextPath("/login")).toBeNull()
    expect(safeNextPath("/login?next=/workspace")).toBeNull()
    expect(safeNextPath("/board/abc")).toBeNull()
    expect(safeNextPath("/workspacex")).toBeNull()
    expect(safeNextPath("/api/ai/insights/run")).toBeNull()
  })

  it("checks the path as the browser will resolve it, not as written", () => {
    expect(safeNextPath("/workspace/../login")).toBeNull()
    expect(safeNextPath("/workspace/..//evil.example")).toBeNull()
    expect(safeNextPath("/workspace/%2e%2e/login")).toBeNull()
    expect(safeNextPath("/workspace/./reports")).toBe("/workspace/reports")
  })

  it("drops the router's own cache-busting parameter", () => {
    expect(safeNextPath("/workspace/reports?_rsc=abc12&status=SUBMITTED")).toBe("/workspace/reports?status=SUBMITTED")
    expect(safeNextPath("/workspace/reports?_rsc=abc12")).toBe("/workspace/reports")
  })

  it("refuses an empty, missing or absurdly long value", () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath("")).toBeNull()
    expect(safeNextPath(`/workspace/reports?q=${"a".repeat(3000)}`)).toBeNull()
  })
})

describe("loginPathFor", () => {
  it("carries a workspace address in ?next=, encoded", () => {
    const path = loginPathFor("/workspace/lampiran", FILE_LINK.slice("/workspace/lampiran".length))
    const url = new URL(path, "https://mission.example")
    expect(url.pathname).toBe("/login")
    expect(url.searchParams.get("next")).toBe(FILE_LINK)
  })

  it("keeps the signed-out reason beside it", () => {
    const url = new URL(loginPathFor("/workspace/reports", "?status=SUBMITTED", { reason: "signed-out" }), "https://mission.example")
    expect(url.searchParams.get("reason")).toBe("signed-out")
    expect(url.searchParams.get("next")).toBe("/workspace/reports?status=SUBMITTED")
  })

  it("keeps the place beside an access error, so signing in with the right account still opens the file", () => {
    const search = FILE_LINK.slice("/workspace/lampiran".length)
    const url = new URL(loginPathFor("/workspace/lampiran", search, { error: "access_not_provisioned" }), "https://mission.example")
    expect(url.searchParams.get("error")).toBe("access_not_provisioned")
    expect(safeNextPath(url.searchParams.get("next"))).toBe(FILE_LINK)
  })

  it("is plain /login when there is nowhere to come back to", () => {
    expect(loginPathFor("/", "")).toBe("/login")
    expect(loginPathFor("/foo", "?x=1")).toBe("/login")
    expect(loginPathFor("/", "", { reason: "signed-out" })).toBe("/login?reason=signed-out")
  })
})
