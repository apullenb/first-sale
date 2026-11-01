import Link from "next/link";
import { Suspense } from "react";
import { DetailField } from "@/components/business/detail-field";
import { Icon } from "@/components/icons";
import { BusinessHeading } from "@/components/intake/business-heading";
import { CHAPTERS, rowsByChapter } from "@/components/intake/chapters";
import { LocalDate } from "@/components/local-date";
import { History } from "@/components/structure/history";
import { EYEBROW, LEAD, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { Card, Chip, IconTile, Note, PageHead } from "@/components/ui";
import { getMyBusiness, getMyDetails, getMyIntakeDraft, listMyHistory } from "@/lib/data/my-business";
import { DECISION_KEYS, DETAIL_KEYS, DETAILS, detailAnchor, type DetailSpec, displayDetail } from "@/lib/details";
import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { answerText, displayName, groupRows, profileToAnswers, sameAnswers, summarize, type SummaryRow, UNANSWERED_NOTE, UNDECIDED_NOTE } from "@/lib/intake/answers";
import { structureOf } from "@/lib/research/applicability";
import { sectionMetadata } from "@/lib/sections";

// LLC and corporation details, hidden once the owner picks a structure that never uses them
function notForStructure(key: string, structure: BusinessStructure | null): boolean {
  if (key === "management") return structure === "sole_proprietorship" || structure === "partnership" || structure === "corporation";
  if (key === "registered_agent") return structure === "sole_proprietorship";
  return false;
}

export const metadata = sectionMetadata("/business");

type SavedDetail = Awaited<ReturnType<typeof getMyDetails>>[number];

export default function BusinessPage({ searchParams }: PageProps<"/business">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading your business…</p>}>
      <BusinessOverview searchParams={searchParams} />
    </Suspense>
  );
}

async function BusinessOverview({ searchParams }: { searchParams: PageProps<"/business">["searchParams"] }) {
  const [{ welcome }, current, details, draft, history] = await Promise.all([
    searchParams,
    getMyBusiness(),
    getMyDetails(),
    getMyIntakeDraft(),
    listMyHistory({ kind: "profile", limit: 10 }),
  ]);

  if (!current) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <PageHead
          kicker="Start your business · Step 1"
          title="Your business"
          lead="Answer a few quick questions, mostly by clicking. Your answers shape your business structure, what applies to you, and the licenses and registrations you need."
        />
        <Card title="Five short chapters" icon="checklist">
          <ul aria-label="Chapters" className="flex flex-wrap gap-2">
            {CHAPTERS.map((chapter) => (
              <li key={chapter.label}>
                <Chip icon={chapter.icon}>{chapter.label}</Chip>
              </li>
            ))}
          </ul>
          {draft?.mode === "create" ? (
            <p className="flex items-center gap-2 text-[15px] text-muted">
              <Icon name="check" size="sm" className="text-accent" />
              <span>
                You’ve started already. Your answers from <LocalDate iso={draft.updatedAt.toISOString()} /> are saved.
              </span>
            </p>
          ) : null}
          <Link href="/business/new" className={PRIMARY_LINK}>
            {draft?.mode === "create" ? "Pick up where you left off" : "Tell us about your business"}
            <Icon name="arrow" size="sm" />
          </Link>
        </Card>
      </div>
    );
  }

  const welcoming = welcome === "1" && current.profile !== null;
  const saved = new Map(details.map((detail) => [detail.key, detail]));
  const structure = current.profile ? structureOf(current.profile, details).structure : null;
  const groups = current.profile ? groupRows(summarize(profileToAnswers(current.profile), { followUps: true })) : null;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className={EYEBROW}>Start your business · Step 1</p>
        <BusinessHeading focusOnMount={welcome === "1"}>{displayName(current.profile)}</BusinessHeading>
        <p className={LEAD}>Your answers shape your business structure, what applies to you, and the licenses and registrations you need.</p>
      </div>

      {welcoming && current.profile ? <Welcome profile={current.profile} /> : null}

      {draft?.mode === "edit" && !(current.profile && sameAnswers(draft.answers, profileToAnswers(current.profile))) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-check-ring bg-check-tint px-4 py-3 text-check">
          <Icon name="pencil" />
          <p className="min-w-0 flex-1 basis-56">You have answer changes you haven’t confirmed yet.</p>
          <Link href="/business/edit" className={SECONDARY_LINK}>
            Review them
          </Link>
        </div>
      ) : null}

      {groups ? (
        <section aria-labelledby="answers-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="answers-heading" className={SECTION_TITLE}>
                Your answers
              </h2>
              <p className="text-muted">You confirmed these. SnapStart uses them everywhere, so you won’t be asked again.</p>
            </div>
            <Link href="/business/edit" className={SECONDARY_LINK}>
              <Icon name="pencil" size="sm" />
              Change answers
            </Link>
          </div>
          {rowsByChapter(groups.confirmed).map(({ chapter, rows }, index) => (
            <Card key={chapter.label} title={chapter.label} icon={chapter.icon} headingLevel={3} id={`answers-chapter-${index}`}>
              <Rows rows={rows} />
            </Card>
          ))}
          {groups.undecided.length ? (
            <Card title="Not decided yet" icon="question" tone="warn" headingLevel={3} id="answers-undecided">
              <p className="text-[15px] text-muted">{UNDECIDED_NOTE}</p>
              <Rows rows={groups.undecided} />
            </Card>
          ) : null}
          {groups.unanswered.length ? (
            <Card title="Not answered" icon="question" tone="warn" headingLevel={3} id="answers-unanswered">
              <p className="text-[15px] text-muted">{UNANSWERED_NOTE}</p>
              <Rows rows={groups.unanswered} />
            </Card>
          ) : null}
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-[14px] border border-check-ring bg-check-tint p-5">
          <p className="text-check">Some of this business’s answers need updating before we can use them.</p>
          <Link href="/business/edit" className={PRIMARY_LINK}>
            Update the answers
          </Link>
        </section>
      )}

      <Card
        title="Decisions"
        icon="scale"
        id="decisions-heading"
        action={
          <span className="hidden sm:block">
            <Link href="/structure" className={SECONDARY_LINK}>
              Compare your options
            </Link>
          </span>
        }
      >
        <dl className="flex flex-col">
          {DECISION_KEYS.map((key) => {
            const decision = saved.get(key);
            return (
              <div key={key} className={ROW}>
                <dt className={ROW_LABEL}>{DETAILS[key].label}</dt>
                <dd className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                  <span className={decision ? "font-semibold" : "text-muted"}>{decision ? displayDetail(key, decision.value) : "Not decided yet"}</span>
                  {decision ? <Origin detail={decision} /> : null}
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="sm:hidden">
          <Link href="/structure" className={SECONDARY_LINK}>
            Compare your options
          </Link>
        </div>
      </Card>

      <Card title="Business details" icon="clipboard" id="details-heading">
        <p className="text-muted">Forms ask for these. Fill them in here, and SnapStart can draft your form answers for you to check.</p>
        <Note icon="lock" tone="quiet">
          SnapStart never stores Social Security or tax ID numbers. Forms leave those for you to fill in yourself.
        </Note>
        <ul className="flex flex-col">
          {DETAIL_KEYS.filter((key) => !(DETAILS[key] as DetailSpec).decision && (saved.has(key) || !notForStructure(key, structure))).map((key) => {
            const detail = saved.get(key);
            return (
              <li key={key} id={detailAnchor(key)} className="scroll-mt-4 border-b border-line py-4 last:border-b-0 last:pb-0">
                <DetailField detailKey={key} value={detail?.value ?? null} origin={detail ? <Origin detail={detail} /> : null} />
              </li>
            );
          })}
        </ul>
      </Card>

      <History title="Answer history" events={history} empty="No changes yet." />

      <div className="flex flex-wrap gap-2.5">
        {current.profile && !welcoming ? (
          <Link href="/structure" className={PRIMARY_LINK}>
            Next: Business structure
            <Icon name="arrow" size="sm" />
          </Link>
        ) : null}
        <Link href="/documents" className={SECONDARY_LINK}>
          <Icon name="book" size="sm" />
          Your documents
        </Link>
      </div>
    </div>
  );
}

const ROW = "flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line py-2.5 first:pt-0 last:border-b-0 last:pb-0";
const ROW_LABEL = "w-full shrink-0 text-[15px] text-muted sm:w-52";

function Rows({ rows }: { rows: SummaryRow[] }) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div key={row.label} className={ROW}>
          <dt className={ROW_LABEL}>{row.label}</dt>
          <dd className={`flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-2 ${row.value ? "font-semibold" : "text-muted"}`}>
            {answerText(row)}
            {row.state === "undecided" ? <Chip tone="warn">Not decided yet</Chip> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Origin({ detail }: { detail: SavedDetail }) {
  const date = <LocalDate iso={detail.updatedAt.toISOString()} />;
  if (detail.source === "owner") return <p className="text-sm text-muted">You entered this on {date}.</p>;
  return (
    <p className="text-sm text-muted">
      {detail.documentId ? (
        <Link href={`/documents/${detail.documentId}`} className={TEXT_LINK}>
          Saved from a document
        </Link>
      ) : (
        "Saved from a document"
      )}{" "}
      on {date}.
    </p>
  );
}

function Welcome({ profile }: { profile: BusinessProfile }) {
  const place = summarize(profileToAnswers(profile)).find((row) => row.step === "place")?.value;
  const items = [
    "Compare business structures, explained for your answers",
    `Find what applies to you in ${place}, from official government sites`,
    "Get your licenses and registrations done in short, ordered parts",
    "Get help understanding and filling in your forms",
  ];

  return (
    <section
      aria-labelledby="welcome-heading"
      className="relative flex flex-col gap-3.5 rounded-2xl border border-line bg-surface py-6 pl-11 pr-5 shadow-lift before:absolute before:inset-y-0 before:left-7 before:w-[1.5px] before:bg-accent-ring sm:pl-12 sm:pr-7"
    >
      <div className="flex items-center gap-3">
        <IconTile icon="check" big />
        <p className={EYEBROW}>Your answers are saved</p>
      </div>
      <h2 id="welcome-heading" className="font-display text-[27px] leading-tight">
        You’re all set.
      </h2>
      <p className="text-rule">Here’s what comes next:</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <Icon name="arrow" size="sm" className="mt-1 text-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link href="/structure" className={`${PRIMARY_LINK} mt-1`}>
        Choose your business structure
        <Icon name="arrow" size="sm" />
      </Link>
    </section>
  );
}
