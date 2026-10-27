import Link from "next/link";
import { Suspense } from "react";
import { HowPhotosAreHandled } from "@/components/photos/how-handled";
import { PhotoLibrary, PhotoList } from "@/components/photos/photo-library";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK } from "@/components/styles";
import { getMyBusiness, listMyPhotoLibrary, listMyPhotos } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { photoEditing } from "@/lib/photos/download";
import { MAX_PHOTO_NAME } from "@/lib/photos/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/photos");
// Uploading checks the photo straight away, which waits on an AI call
export const maxDuration = 300;

export default function PhotosPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Run your business</p>
        <h1 className={PAGE_TITLE}>Product photos</h1>
        <p className="text-lg text-muted">
          Turn an ordinary photo of what you sell into a polished photo for your online store. Upload it, choose a look, and
          First Sale does the rest. Your product stays exactly as it is, and nothing is used until you approve it.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your photos…</p>}>
        <Photos />
      </Suspense>
      <HowPhotosAreHandled />
    </div>
  );
}

async function Photos() {
  const [business, photos, library] = await Promise.all([getMyBusiness(), listMyPhotos(), listMyPhotoLibrary()]);
  if (!business) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <p>Tell us about your business first. Then you can add product photos here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </section>
    );
  }
  const editing = photoEditing();

  return (
    <>
      {editing.state === "practice" ? (
        <PracticeBanner what="Photos made here are development previews, not made by Muse: each one is your original photo, unchanged." />
      ) : null}
      {editing.state === "unavailable" ? (
        <p className="rounded-xl bg-check-tint px-4 py-3 text-[15px] text-check">
          Photo editing isn’t turned on for First Sale yet. You can still upload photos, and edit them once it is.
        </p>
      ) : null}
      <PhotoUpload maxUploadBytes={MAX_UPLOAD_BYTES} nameLimit={MAX_PHOTO_NAME} />
      <PhotoList photos={photos} />
      <PhotoLibrary photos={library} />
    </>
  );
}
