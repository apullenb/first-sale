import Link from "next/link";
import { Suspense } from "react";
import { checkAgainAction, deletePhotoAction, removeFromLibraryAction } from "@/app/(app)/photos/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { RunNotice } from "@/components/documents/run-notice";
import { LocalDate } from "@/components/local-date";
import { ApprovePanel } from "@/components/photos/approve-panel";
import { CheckSummary } from "@/components/photos/check-summary";
import { CompareView } from "@/components/photos/compare-view";
import { fileFacts, originalSrc, versionLabel, versionSrc } from "@/components/photos/labels";
import { PhotoSetup } from "@/components/photos/photo-setup";
import { RefineForm } from "@/components/photos/refine-form";
import { ReviewFlags } from "@/components/photos/review-flags";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyPhoto, lastMyRun } from "@/lib/data/my-business";
import type { PhotoVersionSummary } from "@/lib/data/product-photos";
import { photoEditing } from "@/lib/photos/download";
import { seasonFor } from "@/lib/photos/looks";

export const metadata = { title: "Product photo" };
// Checking and editing wait on AI calls
export const maxDuration = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function PhotoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/photos" className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
        ← All product photos
      </Link>
      <Suspense fallback={<p className="text-muted">Loading the photo…</p>}>
        <PhotoView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Missing() {
  return (
    <section className={`${CARD} flex flex-col gap-3`}>
      <h1 className="font-display text-2xl font-bold">That photo wasn’t found</h1>
      <p className="text-rule">It may have been deleted.</p>
      <Link href="/photos" className={PRIMARY_LINK}>
        Go to your photos
      </Link>
    </section>
  );
}

async function PhotoView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const found = id.length <= 60 ? await getMyPhoto(id) : null;
  if (!found) return <Missing />;
  const { photo, versions } = found;
  const [checkRun, editRun] = await Promise.all([lastMyRun("photo_check", photo.id), lastMyRun("photo_edit", photo.id)]);
  const editing = photoEditing();
  const check = photo.check;
  const requested = typeof query.v === "string" ? query.v : null;
  const selected = versions.find((version) => version.id === requested) ?? versions.at(-1) ?? null;
  const editRunning = editRun?.status === "running";
  const blocked =
    editing.state === "unavailable"
      ? "Photo editing isn’t turned on for First Sale yet."
      : editRunning
        ? "A photo is being made right now. This page will update when it’s done."
        : null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Marketing and branding · Product photos</p>
        <h1 className={PAGE_TITLE}>{photo.title}</h1>
      </div>
      {editing.state === "practice" ? (
        <PracticeBanner what="Photos made here are development previews, not made by Muse: each one is your original photo, unchanged." />
      ) : null}

      <section aria-labelledby="original-heading" className={`${CARD} flex flex-col gap-4`}>
        <h2 id="original-heading" className={SECTION_TITLE}>
          Your photo
        </h2>
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalSrc(photo.id)}
            alt={`Your original photo of ${photo.title}`}
            width={photo.width}
            height={photo.height}
            className="max-h-96 w-auto max-w-full self-start rounded-xl bg-ground object-contain ring-1 ring-ink/10"
          />
          <figcaption className="text-sm text-muted">
            Original, kept exactly as uploaded · {fileFacts(photo)} · <LocalDate iso={photo.createdAt.toISOString()} />
          </figcaption>
        </figure>
        <RunNotice run={checkRun} what="Checking your photo" />
        {check ? (
          <CheckSummary check={check} />
        ) : checkRun?.status !== "running" ? (
          <div className="flex flex-col gap-2">
            <p className="text-rule">{checkRun?.message ?? "This photo hasn’t been checked yet."} It needs a check before it can be edited.</p>
            <ActionButton
              action={checkAgainAction.bind(null, photo.id)}
              label="Check the photo again"
              pendingLabel="Checking…"
              pendingStatus="Checking your photo… this can take a minute"
              variant="ai"
            />
          </div>
        ) : null}
      </section>

      {check?.usable ? (
        <section aria-labelledby="make-heading" className={`${CARD} flex flex-col gap-4`}>
          <h2 id="make-heading" className={SECTION_TITLE}>
            {versions.length ? "Make another version" : "Make a store photo"}
          </h2>
          <RunNotice run={editRun} what="Making your photo" />
          <PhotoSetup
            // A new check resets the choices; a failed edit keeps its message
            key={`${photo.id}:${check.checkedAt}`}
            photoId={photo.id}
            objects={check.objects}
            question={check.question}
            aiCategory={check.method === "ai"}
            initial={{ category: photo.category, forSale: photo.forSale, answer: photo.answer, look: photo.look, crop: photo.crop }}
            season={seasonFor(new Date())}
            hasVersions={versions.length > 0}
            blocked={blocked}
          />
        </section>
      ) : null}

      {selected ? (
        // Keyed so each version starts with a fresh review and change form
        <VersionView
          key={selected.id}
          photo={photo}
          version={selected}
          checking={editRunning && editRun !== null && selected.createdAt >= editRun.startedAt}
          canRefine={Boolean(check?.usable) && !blocked}
        />
      ) : null}
      {versions.length > 1 ? <VersionHistory photoId={photo.id} versions={versions} selectedId={selected?.id ?? null} /> : null}

      <section aria-labelledby="delete-heading" className={`${CARD} flex flex-col gap-3`}>
        <h2 id="delete-heading" className={SECTION_TITLE}>
          Delete this photo
        </h2>
        <p className="text-rule">Removes your original and every version of it, including any in your product library.</p>
        <ActionButton
          action={deletePhotoAction.bind(null, photo.id)}
          label="Delete photo"
          pendingLabel="Deleting…"
          variant="danger"
          confirm="Delete this photo and all its versions? This can’t be undone."
          doneHref="/photos"
        />
      </section>
    </>
  );
}

interface ViewProps {
  photo: { id: string; title: string; width: number; height: number; mimeType: string };
  version: PhotoVersionSummary;
  checking: boolean;
  canRefine: boolean;
}

function VersionView({ photo, version, checking, canRefine }: ViewProps) {
  return (
    <section aria-labelledby="version-heading" className={`${CARD} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <h2 id="version-heading" className={SECTION_TITLE}>
          {versionLabel(version)}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {version.simulated ? (
            <span className="rounded-full bg-check-tint px-2.5 py-0.5 text-xs font-bold text-check">Development preview, not made by Muse</span>
          ) : (
            <>
              <ActorChip actor="ai" /> Edited by Meta’s Muse Image
            </>
          )}
          <span>
            · <LocalDate iso={version.createdAt.toISOString()} />
          </span>
        </p>
        {version.refinement ? <p className="text-rule">You asked: “{version.refinement}”</p> : null}
      </div>

      {version.simulated ? (
        <p className="rounded-xl border border-check/30 bg-check-tint px-4 py-3 text-[15px] text-check">
          <strong>Development preview.</strong> No image service is connected, so this is your original photo, unchanged. It
          isn’t an edited photo and wasn’t made by Muse.
        </p>
      ) : null}

      <CompareView
        original={{
          src: originalSrc(photo.id),
          alt: `Your original photo of ${photo.title}`,
          caption: "Your original",
          width: photo.width,
          height: photo.height,
        }}
        edited={{
          src: versionSrc(photo.id, version.id),
          alt: version.simulated ? `Development preview of ${photo.title}: your original, unchanged` : `Version ${version.number}, the AI edit of ${photo.title}`,
          caption: version.simulated ? `Version ${version.number} (preview)` : `Version ${version.number}`,
          width: version.width,
          height: version.height,
        }}
      />

      <div className="flex flex-col gap-1">
        <a href={versionSrc(photo.id, version.id, false)} download className={SECONDARY_LINK}>
          Download full size
        </a>
        <p className="text-sm text-muted">
          {fileFacts(version)}, exactly as {version.simulated ? "uploaded" : "the image service returned it"}.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Check it against your original</h3>
        <ReviewFlags review={version.review} preview={version.simulated} checking={checking} />
      </div>

      {version.approvedAt ? (
        <div className="flex flex-col gap-2 rounded-xl bg-accent-tint px-4 py-3">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-accent-ink">
            <ActorChip actor="owner" /> In your product library · approved <LocalDate iso={version.approvedAt.toISOString()} />
          </p>
          <ActionButton action={removeFromLibraryAction.bind(null, version.id)} label="Remove from library" pendingLabel="Removing…" />
        </div>
      ) : (
        <ApprovePanel photoId={photo.id} versionId={version.id} preview={version.simulated} />
      )}

      {canRefine ? <RefineForm photoId={photo.id} versionId={version.id} versionNumber={version.number} /> : null}
    </section>
  );
}

function VersionHistory({ photoId, versions, selectedId }: { photoId: string; versions: PhotoVersionSummary[]; selectedId: string | null }) {
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-2.5">
      <h2 id="history-heading" className="font-display text-xl font-bold">
        All versions
      </h2>
      <ul className="flex flex-col gap-2">
        {[...versions].reverse().map((version) => (
          <li key={version.id}>
            <Link
              href={`/photos/${photoId}?v=${version.id}`}
              aria-current={version.id === selectedId ? "true" : undefined}
              className="flex min-h-11 items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-ink/5 hover:ring-ink/20 aria-[current=true]:ring-2 aria-[current=true]:ring-accent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={versionSrc(photoId, version.id)} alt="" width={version.width} height={version.height} loading="lazy" className="size-14 shrink-0 rounded-lg bg-ground object-cover" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{versionLabel(version)}</span>
                <span className="truncate text-sm text-muted">
                  {[
                    version.refinement ? `“${version.refinement}”` : "From your original",
                    version.simulated ? "development preview" : null,
                    version.approvedAt ? "in your library" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
