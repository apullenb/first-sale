import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { draftSocialBiosAction } from "@/app/(app)/social/actions";
import { ActorChip } from "@/components/actor-chip";
import { AlreadyHave } from "@/components/already-have";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { AiProgressButton } from "@/components/marketing/ai-progress";
import { Kicker, NextUp } from "@/components/marketing/pieces";
import { Walkthrough } from "@/components/marketing/step-list";
import { PracticeBanner } from "@/components/practice-banner";
import { RunStatus } from "@/components/run-status";
import { AccountMark } from "@/components/social/account-mark";
import { PickAccounts } from "@/components/social/pick-accounts";
import { ProfileEditor } from "@/components/social/profile-editor";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Chip, IconTile, Note, PageHead } from "@/components/ui";
import { type MarketingPlatformId, PLATFORM_DATA } from "@/data/marketing-platforms";
import { PROFILE_FACTS, profileSources, type SocialProfileFacts } from "@/data/social-profiles";
import type { BrandFile, BrandImageKind, BrandKit } from "@/lib/brand/types";
import { getMyBrand, getMyBusiness, getMyMarketing, lastMyRun, listMyJourneyMarks } from "@/lib/data/my-business";
import type { JourneyMark } from "@/lib/data/journey";
import { CUT_OFF_MESSAGE } from "@/lib/data/workflow-runs";
import { completeIntake } from "@/lib/marketing/intake";
import { type HandHolding, ROLE_LABELS } from "@/lib/marketing/types";
import { withoutPlatforms } from "@/lib/rules/marketing";
import { isSetUp, type SocialAccount, setUpCount, socialAccounts, suggestHandles, suggestName } from "@/lib/rules/social";
import type { SocialProfile } from "@/lib/social/types";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/social");
// Drafting bios waits on an AI call
export const maxDuration = 120;

export default function SocialPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-6 wrap-break-word">
      <PageHead
        kicker={<Kicker icon="users">Build your brand · Step 6</Kicker>}
        title="Set up social media"
        lead="Get each account in your marketing plan ready: a name, a bio you approve, and your profile picture and cover. Then sign up on each site with the steps here."
      />
      <Note icon="lock" tone="quiet">
        You sign up and post yourself. First Sale never signs in, creates accounts or posts for you.
      </Note>
      <Suspense fallback={<p className="text-muted">Loading your accounts…</p>}>
        <SocialView />
      </Suspense>
    </div>
  );
}

const ICONS: Record<MarketingPlatformId, IconName> = {
  instagram: "camera",
  facebook: "users",
  google_business: "pin",
  tiktok: "phone",
  pinterest: "image",
  youtube: "monitor",
  nextdoor: "home",
  yelp: "badge",
  linkedin: "building",
  email_list: "mail",
};

const HELP_NOTES: Record<HandHolding, { social: string; seo: string }> = {
  walkthrough: { social: "Step by step, because you’re new to social media.", seo: "Step by step, because SEO is new to you." },
  guided: { social: "A short checklist, with every click one tap away.", seo: "A short checklist, with every click one tap away." },
  checklist: { social: "A quick checklist, since you’ve run accounts before.", seo: "A quick checklist, since you’ve done SEO before." },
};

const BIO_PROGRESS = {
  title: "Drafting your bios",
  steps: ["Reading your business answers", "Writing a bio for each account", "Fitting each to its platform’s limit", "Taking out links, prices and claims"],
  estimateMs: 15_000,
};

const markDone = (mark: JourneyMark | undefined) => (mark ? { url: mark.url, note: mark.note } : null);

async function SocialView() {
  const [business, marketing, brand, marks, run] = await Promise.all([getMyBusiness(), getMyMarketing(), getMyBrand(), listMyJourneyMarks(), lastMyRun("social_bios", null)]);

  if (!business?.profile) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Your names and bios are drafted from your answers.</p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }

  const profile = business.profile;
  const byKey = new Map(marks.map((mark) => [mark.key, mark]));
  const keys = new Set(byKey.keys());
  const stored = marketing?.intake ?? null;
  const plan = marketing?.plan && stored ? withoutPlatforms(marketing.plan, stored.exclude) : null;
  const accounts = stored ? socialAccounts(stored, plan) : [];
  const social = marketing?.social ?? {};
  const answered = Boolean(completeIntake(stored));
  const whole = (
    <AlreadyHave
      markKey="social"
      label="I already have my social media set up"
      help="Mark this step done if your accounts are already set up the way you want them. Everything on this page stays here to use."
      done={markDone(byKey.get("social"))}
    />
  );

  if (!accounts.length) {
    return (
      <>
        {whole}
        {answered ? (
          <Card title="Your marketing answers didn’t pick any accounts" icon="megaphone" id="none-heading">
            <p className="text-rule">
              {plan?.platforms.length
                ? `Your plan suggests ${plan.platforms.map((entry) => PLATFORM_DATA[entry.platform].name).join(", ")}. Pick the ones you want in your marketing answers, and they’ll show up here.`
                : "Pick the accounts you want in your marketing answers, and they’ll show up here."}
            </p>
            <Link href="/marketing" className={PRIMARY_LINK}>
              Change your marketing answers
              <Icon name="arrow" size="sm" />
            </Link>
          </Card>
        ) : (
          <Card title="Pick your accounts" icon="megaphone" id="pick-heading" bodyClassName="gap-5">
            <p className="text-rule">
              Your marketing plan decides which accounts to set up, and you haven’t made one yet. Make your plan first, or pick your accounts here and make the plan later.
            </p>
            <Link href="/marketing" className={SECONDARY_LINK}>
              Create your marketing plan
              <Icon name="arrow" size="sm" />
            </Link>
            <div className="border-t border-line pt-5">
              <PickAccounts include={stored?.include ?? []} social={stored?.social ?? null} />
            </div>
          </Card>
        )}
      </>
    );
  }

  const done = setUpCount(accounts, keys);
  const share = Math.round((done / accounts.length) * 100);
  const toDraft = accounts.filter((account) => PROFILE_FACTS[account.id]?.bio && !social[account.id]?.bio && !isSetUp(account, keys));
  const running = run?.status === "running";
  const practice = accounts.some((account) => social[account.id]?.bioBy === "practice");
  const next = accounts.find((account) => !isSetUp(account, keys))?.id ?? null;

  return (
    <>
      {whole}

      <Card title="Your accounts" icon="checklist" id="accounts-heading" bodyClassName="gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] text-muted" aria-live="polite">
            <b className="font-bold text-ink">
              {done} of {accounts.length}
            </b>{" "}
            set up
          </p>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-wash">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${share}%` }} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-2">
          {accounts.map((account) => (
            <li key={account.id}>
              <a
                href={`#account-${account.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-[15px] font-semibold shadow-soft hover:border-muted"
              >
                {isSetUp(account, keys) ? <Icon name="check" size="sm" className="text-done" /> : <Icon name={ICONS[account.id]} size="sm" className="text-accent" />}
                {PLATFORM_DATA[account.id].name}
                <span className="sr-only">{isSetUp(account, keys) ? " (set up)" : " (not set up yet)"}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          {plan ? "In the order your marketing plan suggests. " : "From your marketing answers. "}
          <Link href="/marketing" className={TEXT_LINK}>
            Change which accounts
          </Link>
        </p>
      </Card>

      {running || (run && run.message === CUT_OFF_MESSAGE) ? <RunStatus status={running ? "running" : "failed"} message={null} what="Drafting your bios" /> : null}
      {toDraft.length && !running ? (
        <NextUp id="bios-heading" icon="sparkles" kicker="Up next" title="Draft your bios">
          <p className="text-[16.5px] text-muted">
            A short bio for {toDraft.length === 1 ? PLATFORM_DATA[toDraft[0].id].name : `each of your ${toDraft.length} accounts`}, from what you’ve told First Sale. You
            change anything you like before approving.
          </p>
          <ul aria-label="Who does what" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <ActorChip actor="ai" /> drafts each bio
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="rule" /> fit it to each limit and take out links, prices and claims
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="owner" /> edit and approve
            </li>
          </ul>
          <AiProgressButton action={draftSocialBiosAction.bind(null, { platform: null })} label="Draft my bios" {...BIO_PROGRESS} />
        </NextUp>
      ) : null}
      {practice ? <PracticeBanner what="Bios marked “Practice draft” were written from your answers by built-in rules." /> : null}

      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          open={account.id === next}
          mark={byKey.get(`social:${account.id}`)}
          stored={social[account.id] ?? null}
          brand={brand}
          businessName={profile.name}
          city={profile.location.city}
        />
      ))}
    </>
  );
}

function AccountCard({
  account,
  open,
  mark,
  stored,
  brand,
  businessName,
  city,
}: {
  account: SocialAccount;
  // The next account to set up starts open
  open: boolean;
  mark: JourneyMark | undefined;
  stored: SocialProfile | null;
  brand: BrandKit | null;
  businessName: string | null;
  city: string | null;
}) {
  const { id } = account;
  const data = PLATFORM_DATA[id];
  const facts = PROFILE_FACTS[id];
  const setUp = account.have || Boolean(mark);
  const heading = `account-${id}-heading`;
  const list = id === "email_list";
  const status = !facts?.bio
    ? "Steps to follow"
    : stored?.approvedAt
      ? `${facts.bio.label} approved`
      : stored?.bio
        ? `${facts.bio.label} drafted, waiting for you to approve it`
        : `Name, ${facts.bio.label.toLowerCase()}, pictures and steps`;
  const markHere = <AccountMark markKey={`social:${id}`} platformName={data.name} done={markDone(mark)} had={account.have} noun={list ? "list" : "account"} />;

  return (
    <section id={`account-${id}`} aria-labelledby={heading} className="scroll-mt-4 overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <IconTile icon={ICONS[id]} tone={setUp ? "done" : "accent"} />
        <h2 id={heading} className="min-w-[9rem] flex-1 font-display text-[22px] leading-snug">
          {data.name}
        </h2>
        {account.role ? <Chip tone="accent">{ROLE_LABELS[account.role]}</Chip> : null}
        {setUp ? (
          <Chip tone="done" icon="check">
            Set up
          </Chip>
        ) : null}
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
        <p className="text-rule">
          {account.why}
          {account.cadence ? <span className="text-muted"> {account.cadence}</span> : null}
        </p>
        {setUp ? markHere : null}
        <details open={open} className="group/acct rounded-xl border border-line bg-soft">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
            <span className="grid min-w-0 flex-1 gap-px">
              <b className="font-bold text-accent">{setUp ? "What you prepared" : list ? "Start your list" : `Get ${data.name} ready`}</b>
              <small className="text-sm text-muted">{status}</small>
            </span>
            <Icon name="chevron" className="text-faint transition-transform group-open/acct:rotate-90" />
          </summary>
          <div className="flex flex-col gap-6 border-t border-line bg-surface p-4 sm:p-5">
            {facts ? <ProfilePart account={account} facts={facts} stored={stored} businessName={businessName} city={city} /> : null}
            {facts ? <PicturesPart brand={brand} cover={facts.cover} platformName={data.name} /> : null}
            <StepsPart account={account} />
          </div>
        </details>
        {setUp ? null : (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] text-muted">{list ? "Once your list is ready, mark it here." : "Once your account is ready, mark it here."}</p>
            {markHere}
          </div>
        )}
        <Sources facts={facts} account={account} />
      </div>
    </section>
  );
}

function PartHead({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-base font-bold">
      <IconTile icon={icon} tone="gray" />
      {children}
    </h3>
  );
}

function ProfilePart({ account, facts, stored, businessName, city }: { account: SocialAccount; facts: SocialProfileFacts; stored: SocialProfile | null; businessName: string | null; city: string | null }) {
  const handles = facts.handle ? suggestHandles(businessName, city, facts.handle) : [];
  const initial: SocialProfile = {
    name: stored?.name || suggestName(businessName, facts),
    handle: stored?.handle || handles[0] || "",
    bio: stored?.bio ?? "",
    bioBy: stored?.bioBy ?? null,
    notes: stored?.notes ?? [],
    approvedAt: stored?.approvedAt ?? null,
  };
  const title = facts.bio ? `Your name${facts.handle ? ", handle" : ""} and ${facts.bio.label.toLowerCase()}` : "Your name";
  return (
    <div className="flex flex-col gap-3">
      <PartHead icon="pencil">{title}</PartHead>
      <ProfileEditor
        // A new draft or approval from the server starts the editor over
        key={[initial.name, initial.handle, initial.bio, initial.approvedAt].join("|")}
        platform={account.id}
        platformName={PLATFORM_DATA[account.id].name}
        facts={facts}
        initial={initial}
        handles={handles}
        hints={account.help !== "checklist"}
      />
    </div>
  );
}

const IMAGE_FIELDS: Record<BrandImageKind, keyof BrandKit["images"]> = {
  website_hero: "websiteHero",
  facebook_cover: "facebookCover",
  youtube_banner: "youtubeBanner",
  link_preview: "linkPreview",
};

// Brand links open in the browser with ?view=1; without it they download
const download = (file: BrandFile) => file.url.replace(/\?view=1$/, "");

function PicturesPart({ brand, cover, platformName }: { brand: BrandKit | null; cover: BrandImageKind | null; platformName: string }) {
  const profile = brand?.logos.profile ?? null;
  const coverFile = brand && cover ? brand.images[IMAGE_FIELDS[cover]] : null;
  return (
    <div className="flex flex-col gap-3">
      <PartHead icon="image">Your pictures</PartHead>
      {!brand ? (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-rule">Your profile picture comes from your logo{cover ? `, and your ${platformName} cover from your brand images` : ""}. Make your logo first.</p>
          <Link href="/logo" className={SECONDARY_LINK}>
            Create your logo
            <Icon name="arrow" size="sm" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          {profile ? (
            <figure className="flex flex-col items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.url} alt="Your profile picture" width={96} height={96} className="size-24 rounded-full border border-line bg-surface object-cover" />
              <figcaption className="text-sm text-muted">Profile picture</figcaption>
              <a href={download(profile)} download className={SECONDARY_LINK}>
                <Icon name="download" size="sm" />
                Download<span className="sr-only"> your profile picture</span>
              </a>
            </figure>
          ) : (
            <div className="flex max-w-sm flex-col gap-2">
              <p className="text-[15px] text-rule">Approve your logo’s versions to get a profile-picture version made to fit a circle.</p>
              <Link href="/brand" className={SECONDARY_LINK}>
                Build your brand
                <Icon name="arrow" size="sm" />
              </Link>
            </div>
          )}
          {cover ? (
            coverFile ? (
              <figure className="flex min-w-0 flex-1 flex-col items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverFile.url}
                  alt={`Your ${platformName} cover`}
                  width={coverFile.width}
                  height={coverFile.height}
                  className="h-auto w-full max-w-sm rounded-lg border border-line object-cover"
                />
                <figcaption className="text-sm text-muted">{platformName} cover</figcaption>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <a href={download(coverFile)} download className={SECONDARY_LINK}>
                    <Icon name="download" size="sm" />
                    Download<span className="sr-only"> your {platformName} cover</span>
                  </a>
                  <Link href="/brand" className={`${TEXT_LINK} text-[15px]`}>
                    Other sizes in Build your brand
                  </Link>
                </span>
              </figure>
            ) : (
              <div className="flex max-w-sm flex-col gap-2">
                <p className="text-[15px] text-rule">Make your {platformName} cover from your logo’s colors and style.</p>
                <Link href="/brand" className={SECONDARY_LINK}>
                  Build your brand
                  <Icon name="arrow" size="sm" />
                </Link>
              </div>
            )
          ) : null}
          {brand.simulated && (profile || coverFile) ? (
            <p className="w-full text-sm text-muted">These are practice previews, not drawn by the image service.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StepsPart({ account }: { account: SocialAccount }) {
  const data = PLATFORM_DATA[account.id];
  const how = account.have ? data.tidy : data.walkthrough;
  const short = account.have ? data.tidy : data.checklist;
  const go = account.have ? data.home : data.start;
  const title = account.have ? "Get it ready for customers" : data.id === "email_list" ? "Start it" : "Sign up";
  const note = HELP_NOTES[account.help][data.area === "seo" ? "seo" : "social"];
  const list = (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15.5px] marker:text-accent">
      {short.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
  return (
    <div className="flex flex-col gap-3">
      <PartHead icon="checklist">{title}</PartHead>
      <p className="text-sm text-muted">{note}</p>
      {account.help === "walkthrough" ? (
        <Walkthrough how={how} />
      ) : account.help === "checklist" || how.join() === short.join() ? (
        list
      ) : (
        <>
          {list}
          <details className="group/how rounded-xl border border-line bg-soft">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 font-semibold text-accent [&::-webkit-details-marker]:hidden">
              Show me step by step
              <Icon name="chevron" size="sm" className="ml-auto text-faint transition-transform group-open/how:rotate-90" />
            </summary>
            <div className="px-3.5 pb-3.5">
              <Walkthrough how={how} />
            </div>
          </details>
        </>
      )}
      {data.checked === null ? (
        <Note tone="quiet">These steps are general, because First Sale couldn’t check them against {data.name}’s own guide. If your screen looks different, follow its guide.</Note>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {go ? (
          <a href={go.url} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
            {go.label}
            <Icon name="external" size="sm" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        <a href={data.help.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} inline-flex min-h-11 items-center text-[15px]`}>
          {data.help.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

const day = (date: string) => `${date}T12:00:00.000Z`;

function Sources({ facts, account }: { facts: SocialProfileFacts | null; account: SocialAccount }) {
  const data = PLATFORM_DATA[account.id];
  const sources = facts ? profileSources(facts) : [];
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm text-muted">
      {facts?.rules.length ? (
        <ul className="flex flex-col gap-1">
          {facts.rules.map((rule) => (
            <li key={rule} className="flex items-start gap-2">
              <Icon name="info" size="xs" className="mt-[3px] text-faint" />
              {rule}
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        {sources.map((source, index) => (
          <span key={source.url}>
            {index ? "; " : "Limits from "}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
              {source.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            , checked{source.byHand ? " by hand in a browser" : ""} on <LocalDate iso={day(source.checked)} />
          </span>
        ))}
        {sources.length ? ". " : ""}
        {data.checked && account.id === "email_list" ? (
          <>
            The postal address and opt-out rule is from the FTC’s guide, checked on <LocalDate iso={day(data.checked)} />.
          </>
        ) : data.checked ? (
          <>
            Steps compared with {data.help.label} on <LocalDate iso={day(data.checked)} />.
          </>
        ) : null}
      </p>
    </div>
  );
}
