import Link from "next/link";
import { Suspense } from "react";
import { deleteLibraryFileAction } from "@/app/(app)/brand-library/actions";
import { ActionButton } from "@/components/action-button";
import { PracticeTag } from "@/components/brand/asset-view";
import { LibraryUpload } from "@/components/brand/library-upload";
import { latestVersions } from "@/components/brand/versions";
import { formatBytes } from "@/components/documents/labels";
import { Icon, type IconName } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
import { brandFileUrl, kindTitle } from "@/lib/brand/files";
import { LIBRARY_GROUP_TEXT, LIBRARY_GROUPS, type LibraryGroup, libraryFileUrl } from "@/lib/brand/library";
import { IMAGE_KINDS, VERSION_KINDS } from "@/lib/brand/types";
import { LIBRARY_LIMITS } from "@/lib/data/brand-library";
import { getMyBrandState, getMyBusiness, listMyLibraryFiles, listMyPhotoLibrary, listMyPhotos, myLibraryUsage } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/brand-library");

export default function BrandLibraryPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="image">Build your brand</Kicker>}
        title="Your Brand Library"
        lead="Every logo, brand picture and product photo you’ve made or added, sorted into one place. View or download any of them, and add your own pictures."
      />
      <Suspense fallback={<p className="text-muted">Loading your Brand Library…</p>}>
        <Library />
      </Suspense>
    </div>
  );
}

interface Item {
  key: string;
  title: string;
  // What it is or where it came from, such as "Stacked version"
  detail: string;
  view: string;
  download: string;
  width: number;
  height: number;
  practice: boolean;
  tags: string[];
  // Only the owner's own Brand Library uploads can be deleted here
  deleteId: string | null;
}

const GROUP_ICONS: Record<LibraryGroup, IconName> = { logos: "sparkles", brand_images: "palette", product_photos: "camera", other: "image" };
const EMPTY: Record<LibraryGroup, { text: string; href: string; label: string } | null> = {
  logos: { text: "No logos yet.", href: "/logo", label: "Create your logo" },
  brand_images: { text: "No brand pictures yet.", href: "/brand", label: "Build your brand" },
  product_photos: { text: "No product photos yet.", href: "/photos", label: "Make product photos" },
  other: null,
};

const photoUrl = (photoId: string, versionId: string | null, view: boolean) =>
  `/photos/${photoId}${versionId ? `/versions/${versionId}` : ""}/file${view ? "?view=1" : ""}`;

async function Library() {
  const business = await getMyBusiness();
  if (!business) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then your logos, brand pictures and photos collect here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const [state, photos, approved, uploads, usage] = await Promise.all([getMyBrandState(), listMyPhotos(), listMyPhotoLibrary(), listMyLibraryFiles(), myLibraryUsage()]);
  const groups: Record<LibraryGroup, Item[]> = { logos: [], brand_images: [], product_photos: [], other: [] };

  if (state) {
    const chosen = state.assets.find((asset) => asset.id === state.chosenLogoId && asset.kind === "logo") ?? null;
    const brandItem = (asset: (typeof state.assets)[number], title: string, tags: string[]): Item => ({
      key: asset.id,
      title,
      detail: asset.origin === "uploaded" ? "Uploaded by you" : asset.simulated ? "Practice preview" : "Made by Meta’s Muse Image",
      view: brandFileUrl(asset.id),
      download: brandFileUrl(asset.id, false),
      width: asset.width,
      height: asset.height,
      practice: asset.simulated,
      tags,
      deleteId: null,
    });
    if (chosen) {
      groups.logos.push(brandItem(chosen, chosen.origin === "uploaded" && chosen.title ? chosen.title : "Main logo", ["Your chosen logo"]));
      const latest = latestVersions(state.assets, chosen.id);
      for (const kind of VERSION_KINDS) {
        const version = state.assets.find((asset) => asset.id === state.picks[kind] && asset.sourceId === chosen.id) ?? latest[kind];
        if (version) groups.logos.push(brandItem(version, kindTitle(kind), version.id === state.picks[kind] ? ["In your brand kit"] : []));
      }
      for (const kind of IMAGE_KINDS) {
        const made = state.assets.filter((asset) => asset.kind === kind && asset.sourceId === chosen.id);
        const shown = made.find((asset) => asset.id === state.picks[kind]) ?? made.at(-1);
        if (shown) groups.brand_images.push(brandItem(shown, kindTitle(kind), shown.id === state.picks[kind] ? ["In your brand kit"] : []));
      }
    }
    for (const asset of state.assets) {
      if (asset.origin === "uploaded" && asset.id !== chosen?.id) groups.logos.push(brandItem(asset, asset.title ?? "Uploaded logo", []));
    }
  }

  for (const photo of photos) {
    groups.product_photos.push({
      key: photo.id,
      title: photo.title,
      detail: "Your original photo",
      view: photoUrl(photo.id, null, true),
      download: photoUrl(photo.id, null, false),
      width: photo.width,
      height: photo.height,
      practice: false,
      tags: [],
      deleteId: null,
    });
  }
  for (const version of approved) {
    groups.product_photos.push({
      key: version.id,
      title: version.title,
      detail: version.simulated ? "Practice preview" : `Edit ${version.number}, approved by you`,
      view: photoUrl(version.photoId, version.id, true),
      download: photoUrl(version.photoId, version.id, false),
      width: version.width,
      height: version.height,
      practice: version.simulated,
      tags: ["Approved edit"],
      deleteId: null,
    });
  }
  for (const file of uploads) {
    groups[file.group].push({
      key: file.id,
      title: file.title,
      detail: "Added by you",
      view: libraryFileUrl(file.id),
      download: libraryFileUrl(file.id, false),
      width: file.width,
      height: file.height,
      practice: false,
      tags: [],
      deleteId: file.id,
    });
  }

  return (
    <>
      <nav aria-label="Groups in your library" className="flex flex-wrap gap-2">
        {LIBRARY_GROUPS.map((group) => (
          <a key={group} href={`#group-${group}`} className={`${SECONDARY_LINK} text-[15px]`}>
            <Icon name={GROUP_ICONS[group]} size="sm" />
            {LIBRARY_GROUP_TEXT[group].title}
            <span className="text-muted">{groups[group].length}</span>
          </a>
        ))}
      </nav>

      <Card title="Add a picture" icon="upload" id="add-heading">
        <p className="text-[15px] text-rule">Add your own pictures, such as your storefront, your team or work in progress, or logo and brand files you already have.</p>
        <LibraryUpload groups={LIBRARY_GROUPS} initialGroup="other" maxBytes={MAX_UPLOAD_BYTES} />
        <p className="text-sm text-muted">
          You can add up to {LIBRARY_LIMITS.files} pictures and {formatBytes(LIBRARY_LIMITS.totalBytes)} in all. You’ve added {usage.count} ({formatBytes(usage.bytes)}). Files made or uploaded
          elsewhere in First Sale don’t count toward this.
        </p>
      </Card>

      {LIBRARY_GROUPS.map((group) => (
        <Group key={group} group={group} items={groups[group]} />
      ))}

      <p className="text-sm text-muted">
        Every file is kept exactly as it was made or uploaded; nothing here is ever changed. Only you can see them, when you’re signed in. To remove a logo or brand picture, go to{" "}
        <Link href="/logo" className={TEXT_LINK}>
          Create your logo
        </Link>{" "}
        or{" "}
        <Link href="/brand" className={TEXT_LINK}>
          Build your brand
        </Link>
        ; product photos are removed on{" "}
        <Link href="/photos" className={TEXT_LINK}>
          Product photos
        </Link>
        .
      </p>
    </>
  );
}

function Group({ group, items }: { group: LibraryGroup; items: Item[] }) {
  const empty = EMPTY[group];
  const text = LIBRARY_GROUP_TEXT[group];
  return (
    <section id={`group-${group}`} aria-labelledby={`group-${group}-heading`} className="@container scroll-mt-6">
      <Card title={text.title} icon={GROUP_ICONS[group]} id={`group-${group}-heading`} action={<Chip tone="gray">{items.length}</Chip>}>
        <p className="text-[15px] text-muted">{text.help}</p>
        {items.length ? (
          <ul className="grid gap-4 @xl:grid-cols-2 @3xl:grid-cols-3">
            {items.map((item) => (
              <li key={item.key}>
                <Tile item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line-strong bg-soft px-4 py-5">
            <p className="text-muted">{empty?.text ?? "Nothing added yet. Use “Add a picture” above."}</p>
            {empty ? (
              <Link href={empty.href} className={TEXT_LINK}>
                {empty.label}
              </Link>
            ) : null}
          </div>
        )}
      </Card>
    </section>
  );
}

function Tile({ item }: { item: Item }) {
  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
      <div className="grid aspect-[4/3] place-items-center border-b border-line bg-soft p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.view} alt={item.practice ? `Practice preview: ${item.title}` : item.title} width={item.width} height={item.height} loading="lazy" className="max-h-full w-auto max-w-full object-contain" />
      </div>
      <figcaption className="flex flex-1 flex-col gap-2 p-3">
        <span className="font-semibold break-words">{item.title}</span>
        <span className="text-sm text-muted">
          {item.detail} · {item.width} × {item.height}
        </span>
        {item.practice || item.tags.length ? (
          <span className="flex flex-wrap gap-1.5">
            {item.practice ? <PracticeTag /> : null}
            {item.tags.map((tag) => (
              <Chip key={tag} tone="accent">
                {tag}
              </Chip>
            ))}
          </span>
        ) : null}
        <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
          <a href={item.view} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
            <Icon name="eye" size="sm" />
            View<span className="sr-only"> {item.title} (opens in a new tab)</span>
          </a>
          <a href={item.download} download className={`${TEXT_LINK} inline-flex min-h-11 items-center gap-1.5`}>
            <Icon name="download" size="sm" />
            Download<span className="sr-only"> {item.title}</span>
          </a>
        </span>
        {item.deleteId ? (
          <ActionButton
            action={deleteLibraryFileAction.bind(null, item.deleteId)}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            confirm={`Delete “${item.title}” from your Brand Library? Products showing it go back to no photo. This can’t be undone.`}
          />
        ) : null}
      </figcaption>
    </figure>
  );
}
