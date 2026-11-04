import Link from "next/link";
import { Suspense } from "react";
import { suggestItemsAction } from "./actions";
import { ActionButton } from "@/components/action-button";
import { AlreadyHave } from "@/components/already-have";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { SquareLibraryControls } from "@/components/products/square-sync";
import { FromPhoto } from "@/components/products/from-photo";
import { PriceCompare } from "@/components/products/price-compare";
import { type ItemPicture, type ListedProduct, type PhotoChoice, ProductList } from "@/components/products/product-list";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { practiceMode } from "@/lib/ai";
import { LIBRARY_GROUP_TEXT, libraryFileUrl } from "@/lib/brand/library";
import {
  getMyBusiness,
  getMyProductSync,
  getMyWebsitePlan,
  listMyItemPictures,
  listMyItems,
  listMyJourneyMarks,
  listMyLibraryFiles,
  listMyPhotoLibrary,
  listMyPhotos,
  listMyPriceChecks,
} from "@/lib/data/my-business";
import { hasSquareSite } from "@/lib/website/existing-site";
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
  const [items, approved, originals, uploads, marks, pictures, checks, squareSync, websitePlan] = await Promise.all([
    listMyItems(),
    listMyPhotoLibrary(),
    listMyPhotos(),
    listMyLibraryFiles(),
    listMyJourneyMarks(),
    listMyItemPictures(),
    listMyPriceChecks(),
    getMyProductSync(),
    getMyWebsitePlan(),
  ]);
  const mark = marks.find((each) => each.key === "products") ?? null;
  const squareSite = hasSquareSite(websitePlan?.existingSite, marks.find((each) => each.key === "website"));
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
  const listed: ListedProduct[] = items.map((item) => ({ ...item, squareSync: squareSync.products[item.id] }));
  const itemPictures: ItemPicture[] = pictures.map((picture) => ({
    id: picture.id,
    productId: picture.productId,
    view: picture.view,
    change: picture.change,
    simulated: picture.simulated,
    approved: picture.approvedAt !== null,
    src: pictureSrc(picture.id),
  }));
  const counted = (kind: "product" | "service") => {
    const count = listed.filter((item) => item.kind === kind).length;
    return count ? ` (${count})` : "";
  };
  const list = (kind: "product" | "service") => (
    <ProductList
      kind={kind}
      products={listed.filter((item) => item.kind === kind)}
      choices={choices}
      pictures={itemPictures.filter((picture) => listed.some((item) => item.id === picture.productId && item.kind === kind))}
      changeLimit={MAX_PICTURE_CHANGE}
      total={items.length}
      squareConnected={squareSync.connected}
    />
  );

  return (
    <>
      <PageHead
        kicker={kicker}
        title={itemsStepTitle(what, confirmed.length > 0)}
        lead={
          what.services && !what.products
            ? "List each service you offer: what it is, its price, how long it takes and where it happens. Your website and orders use this list."
            : both
              ? "List each product and service you offer, with a short description and its price. Your website and orders use this list."
              : "List each thing you sell, with a short description, its price and a photo. Add what each one costs you to see what you keep from every sale."
        }
      />
      {practice && (items.some((item) => item.descriptionBy === "practice") || pictures.some((picture) => picture.simulated)) ? <PracticeBanner what="Some drafted descriptions or pictures on this page are practice samples." /> : null}

      {squareSite || squareSync.connected ? <SquareLibraryControls connected={squareSync.connected} /> : null}

      <AlreadyHave
        markKey="products"
        label={`My ${noun} are already listed somewhere`}
        help={`If your ${noun} are already listed in an online shop, booking site or marketplace, mark this step done and add the link, so it’s easy to find.`}
        linkLabel="Your shop’s address"
        done={mark ? { url: mark.url, note: mark.note } : null}
      />

      <OnThisPage
        links={[
          ...(what.products ? [{ href: "#products-heading", label: `Add your products${counted("product")}` }] : []),
          ...(what.services ? [{ href: "#services-heading", label: `Add your services${counted("service")}` }] : []),
          { href: "#from-photo", label: "Start from a photo" },
          ...(confirmed.length ? [{ href: "#compare-prices", label: "Compare prices near you" }] : []),
          { href: "#photos", label: what.services && !what.products ? "Make photos" : "Make store photos" },
        ]}
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
          <h2 id="products-heading" className="scroll-mt-6 font-display text-[22px] leading-snug">
            Your products {listed.some((item) => item.kind === "product") ? <span className="text-muted">({listed.filter((item) => item.kind === "product").length})</span> : null}
          </h2>
          {list("product")}
        </section>
      ) : null}

      {what.services ? (
        <section aria-labelledby="services-heading" className="flex flex-col gap-4">
          <h2 id="services-heading" className="scroll-mt-6 font-display text-[22px] leading-snug">
            Your services {listed.some((item) => item.kind === "service") ? <span className="text-muted">({listed.filter((item) => item.kind === "service").length})</span> : null}
          </h2>
          {list("service")}
        </section>
      ) : null}

      {what.services && !what.products ? (
        <section aria-labelledby="extra-products-heading" className="flex flex-col gap-4">
          <details className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <summary id="extra-products-heading" className="cursor-pointer font-semibold">Add a product</summary>
            <p className="mt-3 text-sm text-muted">Sell something alongside your services? Add it here with its own price and photo.</p>
            <div className="mt-5">{list("product")}</div>
          </details>
        </section>
      ) : null}

      <div id="from-photo" className="scroll-mt-6">
        <FromPhoto kinds={[...(what.products ? (["product"] as const) : []), ...(what.services ? (["service"] as const) : [])]} maxUploadBytes={MAX_UPLOAD_BYTES} nameLimit={MAX_PHOTO_NAME} />
      </div>

      <div id="compare-prices" className="scroll-mt-6">
        <PriceCompare
        items={confirmed.map((item) => ({ id: item.id, name: item.name, kind: item.kind, priceCents: item.priceCents, priceText: item.priceText, options: item.options }))}
        noun={noun}
        checks={Object.fromEntries(checks.map((check) => [check.productId, check.result]))}
        />
      </div>

      {what.products || what.services ? (
        <div id="photos" className="scroll-mt-6">
        <Card title={what.services && !what.products ? "Make photos for your services" : "Make polished store photos"} icon="camera" id="photos-heading">
          <p className="text-rule">{what.services && !what.products ? "Generate a picture from your service description, or upload a photo of your work. Review and approve it before using it." : "Turn an ordinary phone photo into a clean store photo. The product stays exactly as it is, and you approve every photo before it shows here."}</p>
          <Link href="/photos" className={SECONDARY_LINK}>
            <Icon name="camera" size="sm" />
            {what.services && !what.products ? "Service photos" : what.services ? "Product and service photos" : "Product photos"}
          </Link>
        </Card>
        </div>
      ) : null}
    </>
  );
}

// Jump links for a long page, most useful on phones
function OnThisPage({ links }: { links: { href: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a key={link.href} href={link.href} className={`${SECONDARY_LINK} text-[15px]`}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
