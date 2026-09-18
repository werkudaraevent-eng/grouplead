import { Camera } from "@/components/icons"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { signPhotoUrls } from "@/lib/photos/photo-storage"
import { describePhotoCount, type PhotoAnswer } from "@/lib/photos/photo-answer"

/**
 * Photos on a detail page: a small grid of thumbnails, each opening the
 * full file in a new tab. Server component, so the signed URLs are minted
 * with the page and expire with the hour.
 */
export async function PhotoGallery({ access, label, photos }: { access: SalesMissionAccess; label: string; photos: PhotoAnswer[] }) {
  if (photos.length === 0) return null
  const urls = await signPhotoUrls(access, photos.map((photo) => photo.path))
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label} <span className="font-normal">· {describePhotoCount(photos.length)}</span></p>
      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {photos.map((photo) => {
          const url = urls.get(photo.path)
          return (
            <li key={photo.path} className="aspect-square overflow-hidden rounded-lg border bg-muted">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full" title={photo.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={photo.name} loading="lazy" className="h-full w-full object-cover" />
                </a>
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground" title="Foto tidak bisa dibuka"><Camera className="h-5 w-5" /></div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
