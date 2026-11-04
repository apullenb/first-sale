import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { HowPhotosAreHandled } from "@/components/photos/how-handled";
import { PhotoLibrary, PhotoList } from "@/components/photos/photo-library";
import { ServicePhotos } from "@/components/photos/service-photos";
import { MAX_PICTURE_CHANGE } from "@/lib/products/picture";
import { sellsWhat } from "@/lib/products/autofill";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Note, PageHead } from "@/components/ui";
import { getMyBusiness, listMyItems, listMyItemPictures, listMyPhotoLibrary, listMyPhotos } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { photoEditing } from "@/lib/photos/download";
import { MAX_PHOTO_NAME } from "@/lib/photos/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = { ...sectionMetadata("/photos"), title: "Photos" };
// Uploading checks the photo straight away, which waits on an AI call
export const maxDuration = 300;

export default function PhotosPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <Suspense fallback={<p className="text-muted">Loading your photos…</p>}>
        <Photos />
      </Suspense>
      <HowPhotosAreHandled />
    </div>
  );
}

async function Photos() {
  const [business, photos, library, items, pictures] = await Promise.all([getMyBusiness(), listMyPhotos(), listMyPhotoLibrary(), listMyItems(), listMyItemPictures()]);
  if (!business) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then you can add photos here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const what = business.profile ? sellsWhat(business.profile, items) : { products: true, services: false };
  const servicesOnly = what.services && !what.products;
  const title = servicesOnly ? "Service photos" : what.services ? "Product and service photos" : "Product photos";
  const editing = photoEditing();

  return (
    <>
      <PageHead kicker={<Kicker icon="camera">Build your brand · {servicesOnly ? "Add your services" : what.services ? "Add what you sell" : "Add your products"}</Kicker>} title={title} lead={what.services ? "Generate pictures for your services or upload photos of your own work. Review and approve every image before using it." : "Turn an ordinary photo of what you sell into a polished photo for your online store. Upload it, choose a look, and SnapStart does the rest. Your product stays exactly as it is, and nothing is used until you approve it."} />

      {editing.state === "practice" ? (
        <PracticeBanner what={what.services ? "Generated service pictures and photo edits are labeled offline previews, not made by AI." : "Photos made here are practice previews, not made by AI: each one is your original photo, unchanged."} />
      ) : null}
      {what.services ? <ServicePhotos changeLimit={MAX_PICTURE_CHANGE} services={items.filter((item) => item.kind === "service")} pictures={pictures.map((picture) => ({ id: picture.id, productId: picture.productId, view: picture.view, change: picture.change, simulated: picture.simulated, approved: picture.approvedAt !== null, src: `/products/pictures/${picture.id}/file?view=1` }))} /> : null}
      {editing.state === "unavailable" ? (
        <Note>Photo editing isn’t turned on for SnapStart yet. You can still upload photos, and edit them once it is.</Note>
      ) : null}
      <PhotoUpload services={servicesOnly} maxUploadBytes={MAX_UPLOAD_BYTES} nameLimit={MAX_PHOTO_NAME} />
      <PhotoList photos={photos} />
      <PhotoLibrary photos={library} services={servicesOnly} />
    </>
  );
}
