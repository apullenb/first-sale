import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { SECONDARY_LINK } from "@/components/styles";
import type { LibraryPhoto, PhotoSummary } from "@/lib/data/product-photos";
import { fileFacts, originalSrc, versionLabel, versionSrc } from "./labels";

// Approved versions, ready to download
export function PhotoLibrary({ photos }: { photos: LibraryPhoto[] }) {
  return (
    <section aria-labelledby="library-heading" className="flex flex-col gap-2.5">
      <h2 id="library-heading" className="font-display text-xl font-bold">
        Your product library
      </h2>
      {photos.length === 0 ? (
        <p className="text-muted">Nothing yet. Photos you approve after checking them appear here, ready to download.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={versionSrc(photo.photoId, photo.id)}
                alt={`Approved photo of ${photo.title}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="aspect-square w-full rounded-xl bg-ground object-contain ring-1 ring-ink/10"
              />
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold">{photo.title}</p>
                <p className="text-sm text-muted">
                  {versionLabel(photo)} · {fileFacts(photo)}
                </p>
                {photo.approvedAt ? (
                  <p className="text-sm text-muted">
                    Approved <LocalDate iso={photo.approvedAt.toISOString()} />
                  </p>
                ) : null}
                {photo.simulated ? (
                  <p className="mt-1 w-fit rounded-full bg-check-tint px-2.5 py-0.5 text-xs font-bold text-check">
                    Development preview, not made by Muse
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={versionSrc(photo.photoId, photo.id, false)} download className={SECONDARY_LINK}>
                  Download
                </a>
                <Link href={`/photos/${photo.photoId}?v=${photo.id}`} className={SECONDARY_LINK}>
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Every upload, with how far along it is
export function PhotoList({ photos }: { photos: PhotoSummary[] }) {
  return (
    <section aria-labelledby="photos-heading" className="flex flex-col gap-2.5">
      <h2 id="photos-heading" className="font-display text-xl font-bold">
        Your photos
      </h2>
      {photos.length === 0 ? (
        <p className="text-muted">No photos yet. Add one above to get started.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {photos.map((photo) => (
            <li key={photo.id}>
              <Link
                href={`/photos/${photo.id}`}
                className="flex min-h-11 items-center gap-4 rounded-2xl bg-surface p-3 ring-1 ring-ink/5 hover:ring-ink/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSrc(photo.id)}
                  alt=""
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  className="size-16 shrink-0 rounded-lg bg-ground object-cover"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-semibold">{photo.title}</span>
                  <span className="text-sm text-muted">{status(photo)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function status(photo: PhotoSummary): string {
  if (!photo.check) return "Not checked yet";
  if (!photo.check.usable) return "Needs a new photo";
  const versions = photo.versionCount === 0 ? "No versions yet" : `${photo.versionCount} ${photo.versionCount === 1 ? "version" : "versions"}`;
  return photo.approvedCount ? `${versions} · ${photo.approvedCount} in your library` : versions;
}
