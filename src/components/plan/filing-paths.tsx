import Link from "next/link";
import { getOfficialFormAction, prepareAnswerGuideAction } from "@/app/(app)/documents/form-actions";
import { fileHref } from "@/components/documents/labels";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { ChoiceOption, NumberedSteps, OrDivider, OutsideLink, siteName } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import type { OfficialForm } from "@/lib/documents/form-catalog";
import type { FilingPaths as Paths } from "@/lib/rules/filing";
import { FilingLines } from "./filing-steps";
import { FormButton } from "./form-button";
import { FormPreview, type FormDoc } from "./official-form-card";

const AFTER = "text-[15px] text-muted";

// One clear choice: fill in the official form here, or apply on the agency's site; each way has its own numbered steps
export function FilingPaths({
  stepId,
  form,
  paths,
  original,
  guide,
  reviewed,
}: {
  stepId: string;
  form: OfficialForm;
  paths: Paths;
  original: FormDoc | null;
  guide: FormDoc | null;
  reviewed: StoredDocument[];
}) {
  const name = form.formNumber ? `Form ${form.formNumber}` : "official form";
  const latest = [...reviewed].sort((a, b) => b.version - a.version)[0] ?? null;
  const record = (
    <p className={AFTER}>
      Once you’ve sent it, use{" "}
      <a href="#progress-heading" className="font-semibold text-ink underline underline-offset-4">
        “I submitted it”
      </a>{" "}
      below. Opening a link or a form never changes this.
    </p>
  );

  const paper = paths.paper ? (
    <NumberedSteps
      label={`Fill in ${name} with First Sale`}
      steps={[
        {
          title: "Check the answers First Sale prepared",
          done: Boolean(original),
          body: original ? (
            <FormPreview label="Official form, kept unchanged, with your drafted answers" item={original} reviewLink={false} />
          ) : (
            <>
              <p className={AFTER}>
                First Sale gets {name} from {form.domain}, checks it’s the right one, keeps the original unchanged, and fills in the blanks your details answer. ID numbers
                and signatures stay blank for you.
              </p>
              <FormButton
                action={getOfficialFormAction}
                stepId={stepId}
                formKey={form.key}
                label="Get the form with my answers"
                pendingLabel="Getting the form…"
                pendingStatus="Downloading the form from the official site and checking it. This takes a few seconds."
                primary
              />
            </>
          ),
        },
        {
          title: "Save and download your filled copy",
          done: Boolean(latest),
          body: !original ? (
            <p className={AFTER}>After step 1.</p>
          ) : latest ? (
            <div className="flex flex-col items-start gap-2">
              <a href={fileHref(latest.id)} className={PRIMARY_LINK}>
                <Icon name="download" size="sm" />
                Download your filled copy
              </a>
              <p className={AFTER}>
                Version {latest.version}, saved <LocalDate iso={latest.createdAt.toISOString()} />. Not filed.{" "}
                <Link href={`/documents/${encodeURIComponent(original.doc.id)}`} className="font-semibold text-ink underline underline-offset-4">
                  Change answers
                </Link>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className={AFTER}>Check each answer, then choose “Save a filled copy”. It holds only the answers you confirmed.</p>
              <Link href={`/documents/${encodeURIComponent(original.doc.id)}`} className={PRIMARY_LINK}>
                <Icon name="pencil" size="sm" />
                Check answers and save a copy
              </Link>
            </div>
          ),
        },
        { title: "Print, sign and send it yourself", body: <FilingLines lines={paths.paper.send} /> },
        { title: "Mark it submitted", body: record },
      ]}
    />
  ) : null;

  const online = paths.online ? (
    <NumberedSteps
      label={`Apply on ${siteName(paths.online.url)}`}
      steps={[
        {
          title: "Get your answers ready to copy",
          done: Boolean(guide),
          body: guide ? (
            <FormPreview label="Answers prepared for the online application" item={guide} />
          ) : (
            <>
              <p className={AFTER}>First Sale prepares your answers from your details, so you can copy them in. You review each one first.</p>
              <FormButton action={prepareAnswerGuideAction} stepId={stepId} formKey={form.key} label="Prepare my answers" pendingLabel="Preparing…" primary />
            </>
          ),
        },
        {
          title: `Fill it in on ${siteName(paths.online.url)}`,
          body: (
            <>
              <OutsideLink href={paths.online.url}>Open the official application</OutsideLink>
              {paths.online.checkedByHand ? (
                <small className="text-sm text-muted">
                  Link checked by hand on <LocalDate iso={`${paths.online.checkedByHand}T12:00:00.000Z`} />: this site doesn’t let First Sale read it automatically.
                </small>
              ) : null}
              <FilingLines lines={paths.online.send} />
            </>
          ),
        },
        { title: "Come back and mark it submitted", body: record },
      ]}
    />
  ) : null;

  if (!paper || !online || !paths.online) return paper ?? online;
  const started = original ? "paper" : guide ? "online" : null;
  const group = `path-${form.key}`;
  return (
    <div role="group" aria-label="Choose how to do it" className="flex flex-col gap-2.5">
      <ChoiceOption
        name={group}
        letter="A"
        title={`Fill in ${name} here`}
        summary={`First Sale fills in the official form from your details. You check it, sign it and send it yourself.`}
        open={started === "paper"}
      >
        {paper}
      </ChoiceOption>
      <OrDivider />
      <ChoiceOption
        name={group}
        letter="B"
        title={`Apply online on ${siteName(paths.online.url)}`}
        summary="First Sale prepares your answers. You copy them into the official site and submit it there."
        open={started === "online"}
      >
        {online}
      </ChoiceOption>
      {started ? null : <p className="text-sm text-muted">Pick one. Both end with you sending it yourself; First Sale never files anything for you.</p>}
    </div>
  );
}

export const usesPaths = (form: OfficialForm | null): form is OfficialForm => Boolean(form && (form.pdfUrl || form.onlineUrl) && !form.selfDownload);

export function MissingDetails({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-[15px] text-check">
      <p className="font-semibold">Add these first, so First Sale can fill them in:</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Link href="/business" className={`${SECONDARY_LINK} text-ink`}>
        <Icon name="pencil" size="sm" />
        Add missing details to your business
      </Link>
    </div>
  );
}
