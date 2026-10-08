import { isCompanyAudio } from "@/lib/audio/audio-answer"
import { isCompanyPhoto } from "@/lib/photos/photo-answer"

/**
 * What a file link (`paths.attachment`, served by `app/workspace/lampiran`)
 * asks for, checked before anything reaches storage.
 *
 * The link is permanent and written into files people keep, so everything in
 * it is untrusted: `jenis` picks the bucket and must be one of the two this
 * app owns; `berkas` must be a path in exactly the shape the uploads write
 * (`<company uuid>/<scope>/<uuid>.<ext>`, no dots but the extension's, so no
 * `..` and no other folder) and inside the caller's own company folder.
 * Nothing else is read from the link: a recording's download name comes from
 * its report (`storedReportRecording`), never from the address, which anyone
 * can rewrite. Pure, so the route and the tests agree.
 */

export type AttachmentKind = "foto" | "rekaman"

export interface AttachmentRequest {
  kind: AttachmentKind
  path: string
}

/** Longer than any path the uploads write; anything longer is not one of ours. */
const PATH_MAX_LENGTH = 200

export function readAttachmentRequest(params: URLSearchParams, companyId: string): AttachmentRequest | null {
  const kind = params.get("jenis")
  const path = params.get("berkas")
  if (!path || path.length > PATH_MAX_LENGTH) return null

  if (kind === "foto") return isCompanyPhoto(path, companyId) ? { kind, path } : null
  if (kind === "rekaman") return isCompanyAudio(path, companyId) ? { kind, path } : null
  return null
}
