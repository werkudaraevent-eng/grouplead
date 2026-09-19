import { AudioFile, Download } from "@/components/icons"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { signAudioDownloads, signAudioUrls } from "@/lib/audio/audio-storage"
import { describeAudioCount, formatBytes, formatDuration, type AudioAnswer } from "@/lib/audio/audio-answer"

/**
 * Recordings on a detail page: a row per file with the native player and
 * a download that keeps the recording's own name, since the next stop is a
 * coaching tool (Fireflies) that wants the file. Server component, so the
 * signed URLs are minted with the page and expire with the hour.
 */
export async function AudioList({ access, label, recordings }: { access: SalesMissionAccess; label: string; recordings: AudioAnswer[] }) {
  if (recordings.length === 0) return null
  const [urls, downloads] = await Promise.all([
    signAudioUrls(access, recordings.map((item) => item.path)),
    signAudioDownloads(access, recordings),
  ])
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label} <span className="font-normal">· {describeAudioCount(recordings.length)}</span></p>
      <ul className="mt-2 space-y-2">
        {recordings.map((item) => {
          const url = urls.get(item.path)
          const download = downloads.get(item.path)
          return (
            <li key={item.path} className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-start gap-3">
                <AudioFile className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[item.durationMs !== undefined ? formatDuration(item.durationMs) : null, formatBytes(item.size)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {download && (
                  <a
                    href={download}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Unduh ${item.name}`}
                    title="Unduh"
                  >
                    <Download className="h-5 w-5" />
                  </a>
                )}
              </div>
              {url ? (
                <audio controls preload="none" src={url} className="mt-2 h-10 w-full" aria-label={`Putar ${item.name}`} />
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Rekaman tidak bisa dibuka.</p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
