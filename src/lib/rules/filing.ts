import type { CheckedFact, OfficialForm } from "@/lib/documents/form-catalog";
import type { PlanLink } from "./plan";

// Plain code: the numbered self-filing steps for one plan step, from checked facts only.
// Anything no official page confirmed says "unknown" instead of guessing.

export interface FilingSource {
  title: string;
  url: string;
  // ISO date, or a timestamp from research
  checkedOn: string;
  // Checked in a browser, not by the app reading the page
  byHand?: boolean;
}

export interface FilingLine {
  text: string;
  source?: FilingSource;
  // Words for a link to open; checkedByHand is the date it was checked in a browser
  link?: { label: string; url: string; checkedByHand?: string; quiet?: boolean };
  address?: string[];
  unknown?: boolean;
}

export interface FilingStep {
  kind: "before" | "gather" | "form" | "cost" | "submit" | "receipt" | "after";
  title: string;
  lines: FilingLine[];
}

export interface FilingInput {
  title: string;
  agency: string;
  feeCents: number | null;
  feeCheckedAt: string | null;
  deadline: string | null;
  renewal: { text: string; feeCents: number | null } | null;
  links: PlanLink[];
  prepare: string[];
  doneWhen: string;
  // Earlier steps not done yet
  waitingOn: string[];
  following: string[];
  form: OfficialForm | null;
  // Details the form's blanks need that the owner hasn't given
  missing: string[];
}

export function money(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
}

const fromFact = (fact: CheckedFact): FilingSource => ({ title: fact.sourceTitle, url: fact.sourceUrl, checkedOn: fact.checkedOn, byHand: fact.byHand });

export function filingSteps(input: FilingInput): FilingStep[] {
  const { form } = input;
  const confirming = input.links.find((link) => link.confirms) ?? null;
  const researched = (checkedAt: string | null): FilingSource | undefined =>
    confirming && checkedAt ? { title: confirming.title, url: confirming.url, checkedOn: checkedAt } : undefined;
  const steps: FilingStep[] = [];

  const before: FilingLine[] = [
    ...input.waitingOn.map((title) => ({ text: `Finish “${title}” first.` })),
    ...(form?.before ?? []).map((fact) => ({ text: fact.text, source: fromFact(fact) })),
  ];
  steps.push({ kind: "before", title: "What has to happen first", lines: before.length ? before : [{ text: "Nothing has to come first. You can start this now." }] });

  const gather: FilingLine[] = [
    ...input.prepare.map((item) => ({ text: item })),
    ...input.missing.map((item) => ({ text: `Still needed from you: ${item}`, unknown: true })),
  ];
  if (gather.length) steps.push({ kind: "gather", title: "Have these ready", lines: gather });

  const formLines: FilingLine[] = [];
  if (form?.pdfUrl) {
    formLines.push({
      text: `${form.onlineUrl ? "Way 1: fill" : "Fill"} in the official ${form.formNumber ? `Form ${form.formNumber}` : "form"}${form.revision ? ` (${form.revision})` : ""} with SnapStart. It downloads the form from ${form.domain}, checks it’s the right one, keeps the original unchanged, and fills in what it can for you to check.`,
      source: { title: form.pageTitle, url: form.pageUrl, checkedOn: form.checkedOn },
    });
  }
  if (form?.onlineUrl) {
    formLines.push({
      text: `${form.pdfUrl ? "Way 2: apply" : "Apply"} online on the agency’s own site. SnapStart prepares your answers first, so you can copy them in.`,
      link: { label: "The official online application", url: form.onlineUrl },
    });
  }
  if (form?.selfDownload) {
    formLines.push({
      text: "Prefer paper? The agency’s site doesn’t let SnapStart download its form, so download it yourself, then upload it to this step for help filling it in.",
      link: { label: form.selfDownload.label, url: form.selfDownload.url },
    });
  }
  if (form && !form.pdfUrl && !form.onlineUrl) {
    formLines.push({
      text: "SnapStart prepared your answers from what the official requirements say this filing must include.",
      source: { title: form.pageTitle, url: form.pageUrl, checkedOn: form.checkedOn },
    });
  }
  if (!form) {
    if (input.links.length) {
      for (const link of input.links) formLines.push({ text: link.confirms ? "The official page for this step:" : "A related official page:", link: { label: link.title, url: link.url, quiet: !link.confirms } });
    } else {
      formLines.push({ text: "We didn’t find the official form or page yet. Send the written question on this step to find out.", unknown: true });
    }
  }
  // Links to sites that refuse automated requests were checked in a browser, and say so
  for (const line of formLines) {
    if (line.link && form?.handChecked?.includes(line.link.url)) line.link.checkedByHand = form.checkedOn;
  }
  steps.push({ kind: "form", title: "The form or application", lines: formLines });

  const cost: FilingLine[] = [];
  const catalogFee = form?.fee ?? null;
  if (input.feeCents !== null) {
    cost.push({ text: `Fee: ${money(input.feeCents)}.`, source: researched(input.feeCheckedAt) });
    // Two official pages disagreeing is shown, never settled by picking one
    if (catalogFee && catalogFee.cents !== input.feeCents) cost.push({ text: `Another official page says: ${catalogFee.text}`, source: fromFact(catalogFee) });
  } else if (catalogFee) {
    cost.push({ text: `Fee: ${catalogFee.text}`, source: fromFact(catalogFee) });
  } else {
    cost.push({ text: "Fee: unknown. No official page we read states it.", unknown: true });
  }
  if (input.deadline) cost.push({ text: `Deadline: ${input.deadline}.`, source: researched(input.feeCheckedAt) });
  else if (form?.deadline) cost.push({ text: `Deadline: ${form.deadline.text}`, source: fromFact(form.deadline) });
  else cost.push({ text: "Deadline: none found on an official page.", unknown: true });
  if (form?.renewal) cost.push({ text: `Renewal: ${form.renewal.text}`, source: fromFact(form.renewal) });
  else if (input.renewal) cost.push({ text: `Renewal: ${input.renewal.text}${input.renewal.feeCents !== null ? `, ${money(input.renewal.feeCents)}` : ""}.`, source: researched(input.feeCheckedAt) });
  steps.push({ kind: "cost", title: "Fees, deadlines and timing", lines: cost });

  const submit: FilingLine[] = (form?.submit ?? []).map((method) => ({
    text: `${method.how}${method.timing ? ` How long it takes: ${method.timing.text}` : ""}`,
    link: method.url ? { label: method.kind === "online" ? "Open the official site" : "Official page", url: method.url, quiet: method.kind !== "online" } : undefined,
    address: method.address,
    source: method.timing ? fromFact(method.timing) : undefined,
  }));
  for (const line of submit) {
    if (line.link && form?.handChecked?.includes(line.link.url)) line.link.checkedByHand = form.checkedOn;
  }
  if (form?.signature) submit.push({ text: form.signature.text, source: fromFact(form.signature) });
  if (!submit.length) {
    submit.push({
      text: `How to submit: unknown. ${confirming ? "The official page explains it" : "We couldn’t confirm it on an official page"}. You submit it yourself${input.agency ? ` to ${input.agency.replace(/^Your /, "your ")}` : ""}; SnapStart never files anything.`,
      unknown: true,
    });
  } else {
    submit.push({ text: "You check, sign and submit it yourself. SnapStart never files anything for you." });
  }
  steps.push({ kind: "submit", title: "Submit it yourself", lines: submit });

  steps.push({
    kind: "receipt",
    title: "Save your receipt",
    lines: [
      { text: `${form?.receipt ? `You’ll get: ${form.receipt}.` : "Keep the confirmation the office gives you."} Upload it to this step, so it’s kept with your documents.` },
    ],
  });

  const after: FilingLine[] = [
    ...(form?.afterward ?? []).map((fact) => ({ text: fact.text, source: fromFact(fact) })),
    ...(input.doneWhen ? [{ text: `Done when: ${input.doneWhen}` }] : []),
    ...input.following.map((title) => ({ text: `Then you can start “${title}”.` })),
  ];
  if (after.length) steps.push({ kind: "after", title: "What happens next", lines: after });
  return steps;
}

export interface FilingPaths {
  // Fill in the official paper form here, then sign and send it
  paper: { send: FilingLine[] } | null;
  // Apply on the agency's own site with the answers SnapStart prepared
  online: { url: string; checkedByHand?: string; send: FilingLine[] } | null;
}

// The two ways to file one form, each with only its own ways to send
export function filingPaths(form: OfficialForm): FilingPaths {
  const byHand = (url: string | undefined) => (url && form.handChecked?.includes(url) ? form.checkedOn : undefined);
  const offline = form.submit.filter((method) => method.kind !== "online");
  const onlineMethods = form.submit.filter((method) => method.kind === "online");

  const paper: FilingLine[] = [
    ...offline.map((method) => ({
      text: `${method.how}${method.timing ? ` How long it takes: ${method.timing.text}` : ""}`,
      address: method.address,
      link: method.url ? { label: "Official page", url: method.url, checkedByHand: byHand(method.url), quiet: true } : undefined,
      source: method.timing ? fromFact(method.timing) : undefined,
    })),
    // An online method that also takes the signed form by mail
    ...onlineMethods.filter((method) => method.address).map((method) => ({ text: "Mail the signed form to:", address: method.address })),
  ];
  if (!paper.length) paper.push({ text: `Send it to ${form.agency} the way the official page says.`, source: { title: form.pageTitle, url: form.pageUrl, checkedOn: form.checkedOn } });
  if (form.signature) paper.push({ text: form.signature.text, source: fromFact(form.signature) });
  paper.push({ text: "Not filed: you sign and send it yourself. SnapStart never files anything for you." });

  const url = onlineMethods.find((method) => method.url)?.url ?? form.onlineUrl;
  const online: FilingLine[] = [
    { text: "Type in the answers SnapStart prepared, then pay and submit it on the official site." },
    ...onlineMethods.flatMap((method) => (method.timing ? [{ text: `How long it takes: ${method.timing.text}`, source: fromFact(method.timing) }] : [])),
    { text: "Anything the site asks you to sign or swear to, you do yourself. SnapStart never files anything for you." },
  ];

  return {
    paper: form.pdfUrl ? { send: paper } : null,
    online: url ? { url, checkedByHand: byHand(url), send: online } : null,
  };
}

export interface FormNextStep {
  title: string;
  lines: FilingLine[];
}

// What the owner does with a prepared form, from the catalog's checked facts; never files it
export function formNextSteps(form: OfficialForm | null, opts: { guide: boolean; stepId: string | null }): FormNextStep[] {
  const mark = opts.stepId ? "Then open its step and choose “I submitted it”, so your plan knows it’s on its way." : "Then mark it submitted on its step, so your plan knows it’s on its way.";
  const check: FormNextStep = { title: "Check every answer", lines: [{ text: "Read each answer above. Blanks for signatures, ID numbers and sworn statements are left for you to fill in yourself." }] };
  if (!form) {
    return [
      check,
      { title: "Save your reviewed version", lines: [{ text: "Use “Save your reviewed version” below to keep a copy with only the answers you confirmed." }] },
      { title: "Send it to the office", lines: [{ text: "The office’s official page says where and how to send this form. SnapStart never files anything for you." }] },
      { title: "Mark it submitted", lines: [{ text: mark }] },
    ];
  }
  if (form.kept) {
    return [
      check,
      { title: "Sign it", lines: [{ text: form.kept.text, source: fromFact(form.kept) }] },
      { title: "Keep it with your records", lines: [{ text: "Don’t send this one in. Keep the signed copy somewhere safe with your business papers." }] },
    ];
  }
  const paths = filingPaths(form);
  const send: FilingLine[] = opts.guide && paths.online
    ? [{ text: `Type your answers into the official application on ${form.domain}, then pay and submit it there.`, link: { label: "Open the official application", url: paths.online.url, checkedByHand: paths.online.checkedByHand } }]
    : (paths.paper?.send ?? []).filter((line) => !/^Not filed/.test(line.text));
  if (!opts.guide && paths.online) send.push({ text: `Or apply online on ${form.domain} instead, copying in the same answers.`, link: { label: "Open the official application", url: paths.online.url, checkedByHand: paths.online.checkedByHand, quiet: true } });
  const fee: FilingLine = form.fee
    ? { text: `The fee is ${money(form.fee.cents)}.`, source: fromFact(form.fee) }
    : { text: "The fee isn’t confirmed yet. Check the official page before you send it.", unknown: true };
  return [
    check,
    {
      title: opts.guide ? "Get your answers ready" : "Download your filled copy",
      lines: [{ text: opts.guide ? "Keep this page open, or save your answers as a guide, so you can copy them in." : "Use “Save your reviewed version” below, then download the filled form and print it." }],
    },
    ...(form.signature && !opts.guide ? [{ title: "Sign it", lines: [{ text: form.signature.text, source: fromFact(form.signature) }] }] : []),
    { title: `Send it to ${form.agency}`, lines: [...send, fee, { text: "SnapStart never files anything for you." }] },
    { title: "Mark it submitted", lines: [{ text: mark }, ...form.afterward.slice(0, 1).map((fact) => ({ text: fact.text, source: fromFact(fact) }))] },
  ];
}
