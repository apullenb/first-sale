import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { HowPhotosAreHandled } from "@/components/photos/how-handled";
import { PhotoLibrary, PhotoList } from "@/components/photos/photo-library";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Note, PageHead } from "@/components/ui";
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
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="camera">Build your brand · Add your products</Kicker>}
        title="Product photos"
        lead="Turn an ordinary photo of what you sell into a polished photo for your online store. Upload it, choose a look, and First Sale does the rest. Your product stays exactly as it is, and nothing is used until you approve it."
      />
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
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then you can add product photos here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const editing = photoEditing();

  return (
    <>
      {editing.state === "practice" ? (
        <PracticeBanner what="Photos made here are development previews, not made by Muse: each one is your original photo, unchanged." />
      ) : null}
      {editing.state === "unavailable" ? (
        <Note>Photo editing isn’t turned on for First Sale yet. You can still upload photos, and edit them once it is.</Note>
      ) : null}
      <PhotoUpload maxUploadBytes={MAX_UPLOAD_BYTES} nameLimit={MAX_PHOTO_NAME} />
      <PhotoList photos={photos} />
      <PhotoLibrary photos={library} />
    </>
  );
}
