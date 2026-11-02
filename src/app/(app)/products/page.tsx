import Link from "next/link";
import { Suspense } from "react";
import { suggestItemsAction } from "./actions";
import { ActionButton } from "@/components/action-button";
import { AlreadyHave } from "@/components/already-have";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { FromPhoto } from "@/components/products/from-photo";
import { PriceCompare } from "@/components/products/price-compare";
import { type ItemPicture, type ListedProduct, type PhotoChoice, ProductList } from "@/components/products/product-list";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { practiceMode } from "@/lib/ai";
import { LIBRARY_GROUP_TEXT, libraryFileUrl } from "@/lib/brand/library";
import {
  getMyBusiness,
  listMyItemPictures,
  listMyItems,
  listMyJourneyMarks,
  listMyLibraryFiles,
  listMyPhotoLibrary,
  listMyPhotos,
  listMyPriceChecks,
} from "@/lib/data/my-business";
import { itemsStepTitle, sellsWhat, suggestedItems } from "@/lib/products/autofill";
import { MAX_PICTURE_CHANGE } from "@/lib/products/picture";
import { MAX_PHOTO_NAME } from "@/lib/photos/upload";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/products");

export default function ProductsPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <Suspense
        fallback={
          <>
            <PageHead kicker={<Kicker icon="tag">Build your brand · Step 4</Kicker>} title="What you sell" />
            <p className="text-muted">Loading what you sell…</p>
          </>
        }
      >
        <Products />
      </Suspense>
    </div>
  );
}

const photoSrc = (photoId: string, versionId: string | null) => `/photos/${photoId}${versionId ? `/versions/${versionId}` : ""}/file?view=1`;
const pictureSrc = (pictureId: string) => `/products/pictures/${pictureId}/file?view=1`;

async function Products() {
  const kicker = <Kicker icon="tag">Build your brand · Step 4</Kicker>;
  const business = await getMyBusiness();
  if (!business?.profile) {
    return (
      <>
        <PageHead kicker={kicker} title="What you sell" />
        <Card title="Tell us about your business first" icon="store" id="first-heading">
          <p className="text-muted">Then you can list what you sell here.</p>
          <Link href="/business/new" className={PRIMARY_LINK}>
            Tell us about your business
            <Icon name="arrow" size="sm" />
          </Link>
        </Card>
      </>
    );
  }
  const profile = business.profile;
  const [items, approved, originals, uploads, marks, pictures, checks] = await Promise.all([
    listMyItems(),
    listMyPhotoLibrary(),
    listMyPhotos(),
    listMyLibraryFiles(),
    listMyJourneyMarks(),
    listMyItemPictures(),
    listMyPriceChecks(),
  ]);
  const mark = marks.find((each) => each.key === "products") ?? null;
  const practice = practiceMode();
  const confirmed = items.filter((item) => item.status === "confirmed");
  const what = sellsWhat(profile, items);
  const suggestions = suggestedItems(profile, items);
  const both = what.products && what.services;
  const noun = both ? "products and services" : what.services ? "services" : "products";

  const choices: PhotoChoice[] = [
    ...pictures
      .filter((picture) => picture.approvedAt)
      .map((picture) => ({
        key: `generated:${picture.id}`,
        ref: { source: "generated" as const, pictureId: picture.id },
        title: items.find((item) => item.id === picture.productId)?.name ?? "Picture",
        detail: picture.simulated ? "Practice preview" : "Approved picture",
        src: pictureSrc(picture.id),
        practice: picture.simulated,
      })),
    ...approved.map((version) => ({
      key: `version:${version.id}`,
      ref: { source: "version" as const, photoId: version.photoId, versionId: version.id },
      title: version.title,
      detail: version.simulated ? "Practice preview" : "Approved store photo",
      src: photoSrc(version.photoId, version.id),
      practice: version.simulated,
    })),
    ...originals.map((photo) => ({
      key: `original:${photo.id}`,
      ref: { source: "original" as const, photoId: photo.id },
      title: photo.title,
      detail: "Your original photo",
      src: photoSrc(photo.id, null),
      practice: false,
    })),
    ...uploads
      .filter((file) => file.group !== "logos")
      .map((file) => ({
        key: `library:${file.id}`,
        ref: { source: "library" as const, fileId: file.id },
        title: file.title,
        detail: `Brand Library · ${LIBRARY_GROUP_TEXT[file.group].title}`,
        src: libraryFileUrl(file.id),
        practice: false,
      })),
  ];
  const listed: ListedProduct[] = items;
  const itemPictures: ItemPicture[] = pictures.map((picture) => ({
    id: picture.id,
    productId: picture.productId,
    view: picture.view,
    change: picture.change,
    simulated: picture.simulated,
    approved: picture.approvedAt !== null,
    src: pictureSrc(picture.id),
  }));
  const list = (kind: "product" | "service") => (
    <ProductList
      kind={kind}
      products={listed.filter((item) => item.kind === kind)}
      choices={choices}
      pictures={itemPictures.filter((picture) => listed.some((item) => item.id === picture.productId && item.kind === kind))}
      changeLimit={MAX_PICTURE_CHANGE}
      total={items.length}
    />
  );

  return (
    <>
      <PageHead
        kicker={kicker}
        title={itemsStepTitle(what, confirmed.length > 0)}
        lead={
          what.services && !what.products
            ? "List the services you offer: what each one is, how you price it, how long it takes and where it happens."
            : both
              ? "List the products and services you offer, with a short description and the price you charge."
              : "List what you sell, with a short description, the price you charge and a photo. Add what each one costs you to see what’s left from every sale."
        }
      />
      {practice ? <PracticeBanner what="Drafted descriptions, pictures and price comparisons on this page are practice samples." /> : null}

      <AlreadyHave
        markKey="products"
        label={`My ${noun} are already listed somewhere`}
        help={`If your ${noun} are already listed in an online shop, booking site or marketplace, mark this step done and add the link, so it’s easy to find.`}
        linkLabel="Your shop’s address"
        done={mark ? { url: mark.url, note: mark.note } : null}
      />

      {suggestions.length ? (
        <Card title="Start from your answers" icon="sparkles" id="suggest-heading">
          <p className="text-rule">
            Your answers named {suggestions.length === 1 ? "this" : "these"}. SnapStart can add {suggestions.length === 1 ? "it" : "them"} as suggestions with a drafted description, for you to check, change or remove.
            Prices stay empty for you to fill in.
          </p>
          <ul className="flex flex-wrap gap-2" aria-label="Suggested from your answers">
            {suggestions.map((item) => (
              <li key={item.name} className="rounded-lg border border-line bg-soft px-3 py-1.5 text-[15px]">
                {item.name}
              </li>
            ))}
          </ul>
          <ActionButton action={suggestItemsAction} label="Add these suggestions" pendingLabel="Drafting descriptions…" pendingStatus="Drafting a short description for each one." variant="ai" />
        </Card>
      ) : null}

      {what.products ? (
        <section aria-labelledby="products-heading" className="flex flex-col gap-4">
          <h2 id="products-heading" className="font-display text-[22px] leading-snug">
            Your products {listed.some((item) => item.kind === "product") ? <span className="text-muted">({listed.filter((item) => item.kind === "product").length})</span> : null}
          </h2>
          {list("product")}
        </section>
      ) : null}

      {what.services ? (
        <section aria-labelledby="services-heading" className="flex flex-col gap-4">
          <h2 id="services-heading" className="font-display text-[22px] leading-snug">
            Your services {listed.some((item) => item.kind === "service") ? <span className="text-muted">({listed.filter((item) => item.kind === "service").length})</span> : null}
          </h2>
          {list("service")}
        </section>
      ) : null}

      <FromPhoto kinds={[...(what.products ? (["product"] as const) : []), ...(what.services ? (["service"] as const) : [])]} maxUploadBytes={MAX_UPLOAD_BYTES} nameLimit={MAX_PHOTO_NAME} />

      <PriceCompare
        items={confirmed.map((item) => ({ id: item.id, name: item.name, kind: item.kind, priceCents: item.priceCents, priceText: item.priceText, options: item.options }))}
        checks={Object.fromEntries(checks.map((check) => [check.productId, check.result]))}
      />

      {what.products ? (
        <Card title="Make polished store photos" icon="camera" id="photos-heading">
          <p className="text-rule">Turn an ordinary phone photo into a clean store photo. The product stays exactly as it is, and you approve every photo before it shows here.</p>
          <Link href="/photos" className={SECONDARY_LINK}>
            <Icon name="camera" size="sm" />
            Product photos
          </Link>
        </Card>
      ) : null}
    </>
  );
}
