import { describe, expect, it } from "vitest"
import { paths } from "@/lib/paths"
import { readAttachmentRequest } from "./attachment-request"

const COMPANY = "11111111-1111-4111-8111-111111111111"
const OTHER = "99999999-9999-4999-8999-999999999999"
const PHOTO = `${COMPANY}/report/22222222-2222-4222-8222-222222222222.jpg`
const AUDIO = `${COMPANY}/report/33333333-3333-4333-8333-333333333333.m4a`

function read(query: Record<string, string>, companyId = COMPANY) {
  return readAttachmentRequest(new URLSearchParams(query), companyId)
}

/** What the route receives for a link the export wrote. */
function fromLink(href: string) {
  return readAttachmentRequest(new URL(href, "https://mission.example").searchParams, COMPANY)
}

describe("readAttachmentRequest", () => {
  it("accepts the links the export writes, photo and recording", () => {
    expect(fromLink(paths.attachment("foto", PHOTO))).toEqual({ kind: "foto", path: PHOTO })
    expect(fromLink(paths.attachment("rekaman", AUDIO))).toEqual({ kind: "rekaman", path: AUDIO })
  })

  it("reads the same link back after the server re-encoded its slashes on the way through sign-in", () => {
    const reencoded = `/workspace/lampiran?jenis=foto&berkas=${encodeURIComponent(PHOTO)}`
    expect(reencoded).toContain("%2F")
    expect(fromLink(reencoded)).toEqual({ kind: "foto", path: PHOTO })
  })

  it("writes the link with the path's slashes readable, and nothing else", () => {
    expect(paths.attachment("foto", PHOTO)).toBe(`/workspace/lampiran?jenis=foto&berkas=${PHOTO}`)
    expect(paths.attachment("rekaman", AUDIO)).toBe(`/workspace/lampiran?jenis=rekaman&berkas=${AUDIO}`)
  })

  it("refuses a file in another company's folder", () => {
    expect(read({ jenis: "foto", berkas: PHOTO }, OTHER)).toBeNull()
    expect(read({ jenis: "rekaman", berkas: AUDIO }, OTHER)).toBeNull()
  })

  it("refuses a path in the wrong bucket for its kind", () => {
    expect(read({ jenis: "foto", berkas: AUDIO })).toBeNull()
    expect(read({ jenis: "rekaman", berkas: PHOTO })).toBeNull()
  })

  it("refuses any other kind, so no other bucket is reachable", () => {
    expect(read({ jenis: "avatars", berkas: PHOTO })).toBeNull()
    expect(read({ jenis: "FOTO", berkas: PHOTO })).toBeNull()
    expect(read({ berkas: PHOTO })).toBeNull()
  })

  it("refuses traversal, absolute paths, addresses and anything not shaped like an upload", () => {
    for (const berkas of [
      `${COMPANY}/../${OTHER}/report/22222222-2222-4222-8222-222222222222.jpg`,
      `${COMPANY}/report/../../22222222-2222-4222-8222-222222222222.jpg`,
      `/${PHOTO}`,
      `${PHOTO}?download=1`,
      `${PHOTO}/`,
      `https://evil.example/${PHOTO}`,
      `${COMPANY}/report/not-a-uuid.jpg`,
      `${COMPANY}/report/22222222-2222-4222-8222-222222222222.svg`,
      `${COMPANY}/re.port/22222222-2222-4222-8222-222222222222.jpg`,
      `${COMPANY}/report/22222222-2222-4222-8222-222222222222.jpg\n`,
      "",
    ]) {
      expect(read({ jenis: "foto", berkas }), berkas).toBeNull()
    }
    expect(read({ jenis: "foto" })).toBeNull()
  })

  it("reads no download name from the link, so a forwarded link cannot rename the file", () => {
    expect(read({ jenis: "rekaman", berkas: AUDIO, nama: "Slip Gaji.exe#.m4a" })).toEqual({ kind: "rekaman", path: AUDIO })
  })
})
