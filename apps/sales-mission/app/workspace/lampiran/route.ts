import { NextResponse } from "next/server"
import { readAttachmentRequest } from "@/lib/attachments/attachment-request"
import { signAudioDownloads, storedReportRecording } from "@/lib/audio/audio-storage"
import { loginPathFor } from "@/lib/auth/next-path"
import { paths } from "@/lib/paths"
import { signPhotoUrls } from "@/lib/photos/photo-storage"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"

export const dynamic = "force-dynamic"

/**
 * How long the storage link this route hands out stays valid. The browser
 * follows the redirect at once, so minutes are plenty; a copy taken from the
 * address bar dies before it is worth forwarding.
 */
const LINK_SECONDS = 5 * 60

/**
 * One stored photo or recording, opened through the app: the permanent link
 * an exported workbook carries in every file cell (`paths.attachment`).
 *
 * The workbook used to carry storage links signed for seven days, so a file
 * opened the week after showed dead links, and anyone the workbook was
 * forwarded to could open every photo in it without an account. This address
 * never expires and opens nothing by itself: the proxy sends a visitor
 * without a session to /login with the address in `?next=` and brings them
 * back after signing in; here the person must have Sales Activity, the path
 * must be one of the shapes the uploads write and sit in their own company's
 * folder (`readAttachmentRequest`), and the short-lived storage link is signed
 * with their own session, so the bucket's policies still decide.
 *
 * A photo opens in the browser; a recording downloads under the name its
 * report gave it, read from the report rather than from the link. A file that
 * was removed from storage, or a link that is not one of ours, lands on a
 * page that says so rather than on storage's JSON error. The storage link
 * itself lives five minutes, so a photo tab reloaded later shows storage's
 * error; clicking the file's link again signs a new one (DESIGN.md).
 *
 * Any Sales Activity user of the company may open a file, as on the activity
 * page (`signPhotos`, `signAudio`) and as the bucket policies allow; the
 * Laporan grant guards the export, not the files it names.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const access = await getSalesMissionAccess()
  // The proxy already turned away a visitor with no session; whoever is left
  // is signed in without Sales Activity (a Group Lead-only account on the
  // shared cookie), and the login page explains that. The link rides along
  // in `next`, so signing in with the right account still opens the file.
  if (!access) {
    const login = loginPathFor(url.pathname, url.search, { error: "access_not_provisioned" })
    return NextResponse.redirect(new URL(login, request.url), { status: 303, headers: { "Cache-Control": "no-store" } })
  }

  const target = readAttachmentRequest(url.searchParams, access.companyId)
  let signed: string | undefined
  if (target?.kind === "foto") {
    signed = (await signPhotoUrls(access, [target.path], LINK_SECONDS)).get(target.path)
  } else if (target?.kind === "rekaman") {
    const recording = await storedReportRecording(access, target.path)
    signed = (await signAudioDownloads(access, [recording], LINK_SECONDS)).get(target.path)
  }

  // Never cached: the storage link inside expires in minutes, and the answer
  // depends on who is asking.
  return NextResponse.redirect(signed ?? new URL(paths.attachmentUnavailable, request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  })
}
