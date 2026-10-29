import Link from "next/link";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { SectionHead } from "@/components/marketing/pieces";
import { SECONDARY_LINK } from "@/components/styles";
import type { LibraryPhoto, PhotoSummary } from "@/lib/data/product-photos";
import { fileFacts, originalSrc, versionLabel, versionSrc } from "./labels";

const GALLERY = "grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4";
// Like a Chip, but wraps inside a narrow gallery card
const TAG = "inline-flex w-fit items-start gap-1.5 rounded-lg border px-2.5 py-1 text-[13.5px] font-semibold leading-snug";
const EMPTY = "flex items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-6 text-muted shadow-soft";

// Approved versions, ready to download
export function PhotoLibrary({ photos }: { photos: LibraryPhoto[] }) {
  return (
    <section aria-labelledby="library-heading" className="flex flex-col gap-4">
      <SectionHead id="library-heading" icon="check" title="Your product library" lead="Photos you approved, ready to download." />
      {photos.length === 0 ? (
        <p className={EMPTY}>
          <Icon name="image" className="text-faint" />
          Nothing yet. Photos you approve after checking them appear here, ready to download.
        </p>
      ) : (
        <ul className={GALLERY}>
          {photos.map((photo) => (
            <li key={photo.id} className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={versionSrc(photo.photoId, photo.id)}
                alt={`Approved photo of ${photo.title}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                className="aspect-square w-full border-b border-line bg-soft object-contain"
              />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <p className="font-bold">{photo.title}</p>
                  <p className="text-sm text-muted">
                    {versionLabel(photo)} · {fileFacts(photo)}
                  </p>
                  {photo.approvedAt ? (
                    <p className="text-sm text-muted">
                      Approved <LocalDate iso={photo.approvedAt.toISOString()} />
                    </p>
                  ) : null}
                  {photo.simulated ? <span className={`${TAG} mt-1.5 border-check-ring bg-check-tint text-check`}>Development preview, not made by Muse</span> : null}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <a href={versionSrc(photo.photoId, photo.id, false)} download className={SECONDARY_LINK}>
                    <Icon name="download" size="sm" />
                    Download
                  </a>
                  <Link href={`/photos/${photo.photoId}?v=${photo.id}`} className={SECONDARY_LINK}>
                    Open
                  </Link>
                </div>
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
    <section aria-labelledby="photos-heading" className="flex flex-col gap-4">
      <SectionHead id="photos-heading" icon="camera" title="Your photos" lead="Open one to choose a look, compare it with your original and approve it." />
      {photos.length === 0 ? (
        <p className={EMPTY}>
          <Icon name="camera" className="text-faint" />
          No photos yet. Add one above to get started.
        </p>
      ) : (
        <ul className={GALLERY}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <Link
                href={`/photos/${photo.id}`}
                className="group/photo flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-soft transition hover:-translate-y-px hover:border-line-strong hover:shadow-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSrc(photo.id)}
                  alt=""
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  className="aspect-[4/3] w-full border-b border-line bg-soft object-cover"
                />
                <span className="flex flex-1 items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate font-bold">{photo.title}</span>
                    <StatusLine photo={photo} />
                  </span>
                  <Icon name="chevron" className="text-faint transition group-hover/photo:text-accent" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusLine({ photo }: { photo: PhotoSummary }) {
  const text = status(photo);
  if (photo.check && !photo.check.usable) return <span className={`${TAG} border-check-ring bg-check-tint text-check`}>{text}</span>;
  if (photo.approvedCount) {
    return (
      <span className={`${TAG} border-done/25 bg-done-tint text-done`}>
        <Icon name="check" size="xs" className="mt-[3px]" />
        {text}
      </span>
    );
  }
  return <span className="text-sm text-muted">{text}</span>;
}

function status(photo: PhotoSummary): string {
  if (!photo.check) return "Not checked yet";
  if (!photo.check.usable) return "Needs a new photo";
  const versions = photo.versionCount === 0 ? "No versions yet" : `${photo.versionCount} ${photo.versionCount === 1 ? "version" : "versions"}`;
  return photo.approvedCount ? `${versions} · ${photo.approvedCount} in your library` : versions;
}
