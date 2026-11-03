"use client";

import { useState, useTransition } from "react";
import { pauseOperationAction, saveOperationAction } from "@/app/(app)/run/actions";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY, INPUT, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";
import { defaultOperation, demoOperation, operationSetupSchema, type OperationSetup, type SampleItem } from "@/lib/rules/operations";

type Saved = { config: OperationSetup; paused: boolean };

export function OperationSetupPanel({ kind, initial, sampleItem = null }: { kind: OperationKind; initial: Saved | null; sampleItem?: SampleItem | null }) {
  const definition = OPERATIONS[kind];
  const [saved, setSaved] = useState(initial);
  const [config, setConfig] = useState(() => initial?.config ?? defaultOperation(kind));
  const [stage, setStage] = useState<"choose" | "configure" | "review" | "saved">(initial ? "saved" : "choose");
  const [message, setMessage] = useState("");
  const [sample, setSample] = useState<ReturnType<typeof demoOperation> | null>(null);
  const [pending, startTransition] = useTransition();
  const needsEmail = kind === "email" || config.source === "Email";

  function review() {
    const checked = operationSetupSchema.safeParse(config);
    if (!checked.success) { setMessage(checked.error.issues[0]?.message ?? "Check your answers."); return; }
    setMessage("");
    setStage("review");
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await saveOperationAction(config);
        setMessage(result.message);
        if (result.ok) { setSaved({ config, paused: false }); setStage("saved"); setSample(null); }
      } catch { setMessage("Your setup could not be saved. Try again."); }
    });
  }

  function togglePaused() {
    if (!saved) return;
    const paused = !saved.paused;
    startTransition(async () => {
      try {
        const result = await pauseOperationAction({ kind, paused });
        setMessage(result.message);
        if (result.ok) { setSaved({ ...saved, paused }); setSample(null); }
      } catch { setMessage("That change could not be saved. Try again."); }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <dl aria-label="What this does today" className="grid gap-2 text-[15px] text-rule">
        <div><dt className="inline font-semibold">Works now: </dt><dd className="inline">{definition.worksNow}</dd></div>
        <div><dt className="inline font-semibold">Needs a connection (not available yet): </dt><dd className="inline">{definition.needsConnection}</dd></div>
        <div><dt className="inline font-semibold">After setup: </dt><dd className="inline">{definition.afterSetup}</dd></div>
      </dl>
      {stage !== "saved" ? <ol aria-label="Setup progress" className="flex flex-wrap gap-3 text-sm text-muted">{(["choose", "configure", "review"] as const).map((step, index) => <li key={step} aria-current={stage === step ? "step" : undefined} className={stage === step ? "font-bold text-accent" : ""}>{index + 1}. {step === "choose" ? "Choose your help" : step === "configure" ? "Set preferences" : "Review setup"}</li>)}</ol> : null}
      {stage === "choose" ? <Card title="What would you like help with?" id="choose-help">
        <p className="text-muted">Choose one or both. You can change these later.</p>
        <fieldset className="flex flex-col gap-2"><legend className="sr-only">Tasks to include</legend>{definition.goals.map((goal) => <label key={goal} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line p-3"><input type="checkbox" checked={config.goals.includes(goal)} onChange={(event) => setConfig({ ...config, goals: event.target.checked ? [...config.goals, goal] : config.goals.filter((value) => value !== goal) })} className="size-5 accent-accent" />{goal}</label>)}</fieldset>
        <button className={PRIMARY} disabled={!config.goals.length} onClick={() => { setMessage(""); setStage("configure"); }}>Continue</button>
      </Card> : null}
      {stage === "configure" ? <Card title="Make it fit your business" id="configure-help">
        <form data-demo-ok className="flex flex-col gap-5" onSubmit={(event) => { event.preventDefault(); review(); }}>
          <label className="flex flex-col gap-2 font-semibold">{definition.sourceLabel}<select className={INPUT} value={config.source} onChange={(event) => setConfig({ ...config, source: event.target.value, email: "" })}>{definition.choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label>
          {needsEmail ? <label className="flex flex-col gap-2 font-semibold">Business email to connect later<input className={INPUT} type="email" required maxLength={254} autoComplete="email" value={config.email} onChange={(event) => setConfig({ ...config, email: event.target.value })} /><span className="text-sm font-normal text-muted">Saved as a preference only. It doesn’t give access to your inbox, so never enter a password here.</span></label> : null}
          {kind === "requests" && config.source === "Website" ? <p className="text-muted">A live website connection will need a supported form or store integration. This demo does not read your website.</p> : null}
          <label className="flex flex-col gap-2 font-semibold">Follow up if still waiting after<select className={INPUT} value={config.reminder} onChange={(event) => setConfig({ ...config, reminder: event.target.value as OperationSetup["reminder"] })}>{["1", "2", "3", "7"].map((days) => <option key={days} value={days}>{days} day{days === "1" ? "" : "s"}</option>)}</select></label>
          <div className="flex flex-wrap gap-3"><button type="button" className={SECONDARY} onClick={() => setStage("choose")}>Back</button><button className={PRIMARY}>Review setup</button></div>
        </form>
      </Card> : null}
      {stage === "review" || stage === "saved" ? <Card title={stage === "review" ? "Review your workflow" : "Your saved workflow"} id="review-help">
        {stage === "saved" ? <Chip tone="gray">{saved?.paused ? "Demo paused" : "Demo ready · No live connection"}</Chip> : null}
        <dl className="grid gap-3 text-rule"><div><dt className="font-semibold">Source</dt><dd>{config.source}{config.email ? ` · ${config.email}` : ""}</dd></div><div><dt className="font-semibold">Help with</dt><dd>{config.goals.join("; ")}</dd></div><div><dt className="font-semibold">Follow-up preference</dt><dd>After {config.reminder} day{config.reminder === "1" ? "" : "s"} without a response</dd></div></dl>
        <div className="rounded-xl bg-wash p-4"><p className="font-semibold">When connected, the intended workflow is:</p><p className="mt-2 text-muted">{definition.trigger}</p><ol className="mt-3 list-decimal space-y-2 pl-5">{(kind === "email" && !config.goals.includes("Draft customer replies") ? ["Read messages from your chosen inbox", "Flag customer messages for your attention", "Wait for you to review and respond"] : definition.steps).map((step) => <li key={step}>{step}</li>)}</ol></div>
        <p className="text-muted">You review every reply before sending it. You confirm order changes; stock and money are never changed by a drafted reply.</p>
        <div className="flex flex-wrap gap-3">{stage === "review" ? <><button className={SECONDARY} disabled={pending} onClick={() => setStage("configure")}>Back</button><button data-writes className={PRIMARY} disabled={pending} onClick={save}>{pending ? "Saving…" : "Approve & save demo setup"}</button></> : <><button className={PRIMARY} disabled={pending || saved?.paused} onClick={() => { setSample(demoOperation(config, sampleItem)); setMessage(""); }}>Try a demo</button><button className={SECONDARY} disabled={pending} onClick={() => { setSample(null); setMessage(""); setStage("choose"); }}>Edit setup</button><button data-writes className={SECONDARY} disabled={pending} onClick={togglePaused}>{saved?.paused ? "Resume demo" : "Pause demo"}</button></>}</div>
      </Card> : null}
      <p role="status" aria-live="polite" className="text-sm text-accent">{message}</p>
      {sample ? <Card title={sample.title} id="demo-result" tone="warn"><PracticeBanner what="This is a built-in sample workflow, using a fictional customer message." /><p className="rounded-lg bg-wash p-3">“{sample.message}”</p><p>{sample.result}</p><p className="text-muted">{sample.reminder} This demo does not schedule a notification.</p>{kind === "email" && config.goals.includes("Draft customer replies") ? <div className="rounded-lg border border-line p-4"><p className="font-semibold">Sample reply · Not sent</p><p>Thanks for getting in touch! What would you like to order, and when would you need it? I’ll confirm the details with you before accepting your order.</p></div> : null}</Card> : null}
    </div>
  );
}
