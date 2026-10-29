import Link from "next/link";
import { Suspense } from "react";
import { AlreadyHave } from "@/components/already-have";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { type PhotoChoice, ProductList } from "@/components/products/product-list";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { LIBRARY_GROUP_TEXT, libraryFileUrl } from "@/lib/brand/library";
import { getMyBusiness, listMyJourneyMarks, listMyLibraryFiles, listMyPhotoLibrary, listMyPhotos, listMyProducts } from "@/lib/data/my-business";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/products");

export default function ProductsPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="tag">Build your brand · Step 4</Kicker>}
        title="Add your products"
        lead="List what you sell, with a short description, the price you charge and a photo. Add what each one costs you to see what’s left from every sale."
      />
      <Suspense fallback={<p className="text-muted">Loading your products…</p>}>
        <Products />
      </Suspense>
    </div>
  );
}

const photoSrc = (photoId: string, versionId: string | null) => `/photos/${photoId}${versionId ? `/versions/${versionId}` : ""}/file?view=1`;

async function Products() {
  const business = await getMyBusiness();
  if (!business) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then you can list what you sell here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const [products, approved, originals, uploads, marks] = await Promise.all([listMyProducts(), listMyPhotoLibrary(), listMyPhotos(), listMyLibraryFiles(), listMyJourneyMarks()]);
  const mark = marks.find((each) => each.key === "products") ?? null;
  const choices: PhotoChoice[] = [
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

  return (
    <>
      <AlreadyHave
        markKey="products"
        label="My products are already listed somewhere"
        help="If your products are already listed in an online shop or on a marketplace, mark this step done and add the link, so it’s easy to find."
        linkLabel="Your shop’s address"
        done={mark ? { url: mark.url, note: mark.note } : null}
      />

      <section aria-labelledby="products-heading" className="flex flex-col gap-4">
        <h2 id="products-heading" className="font-display text-[22px] leading-snug">
          Your products {products.length ? <span className="text-muted">({products.length})</span> : null}
        </h2>
        <ProductList
          products={products.map(({ id, name, description, priceCents, unitCostCents, quantity, photo }) => ({ id, name, description, priceCents, unitCostCents, quantity, photo }))}
          choices={choices}
        />
      </section>

      <Card title="Make polished store photos" icon="camera" id="photos-heading">
        <p className="text-rule">Turn an ordinary phone photo into a clean store photo. The product stays exactly as it is, and you approve every photo before it shows here.</p>
        <Link href="/photos" className={SECONDARY_LINK}>
          <Icon name="camera" size="sm" />
          Product photos
        </Link>
      </Card>
    </>
  );
}
