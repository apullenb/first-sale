"use client";

/* eslint-disable @next/next/no-img-element -- Private library images require the owner session. */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveWebsiteCopyAction } from "@/app/(app)/website/actions";
import { designThemeAction, saveWebsiteBuilderAction } from "@/app/(app)/website/site-actions";
import { LibraryUpload } from "@/components/brand/library-upload";
import { PracticeBanner } from "@/components/practice-banner";
import { Icon } from "@/components/icons";
import { INPUT, PRIMARY, TEXT_LINK } from "@/components/styles";
import { failedMessage } from "@/lib/failure";
import { dollars, itemFor, parseDollars, SECTION_LABELS, SITE_SECTIONS, withProducts, type SiteDesign, type SiteItem, type SiteProduct, type SiteTheme } from "@/lib/website/site/design";
import { renderSite, type SiteImage } from "@/lib/website/site/render";
import type { WebsiteCopy } from "@/lib/website/types";
import { FullScreenPreview } from "./site-frame";

export interface BuilderImage extends SiteImage { id: string; photoId: string; title: string; simulated: boolean }
export interface WebsiteEditorProps {
  name: string;
  revision: string;
  draftedAt: string;
  approved: boolean;
  simulated: boolean;
  copy: WebsiteCopy;
  design: SiteDesign;
  images: { logo: SiteImage | null; hero: SiteImage | null; favicon: SiteImage | null };
  library: BuilderImage[];
  products: SiteProduct[];
  brandColors: { hex: string; name: string }[];
  contact: { email: string | null; phone: string | null };
  domain: string | null;
  year: number;
  checks: { blockers: string[]; notes: string[] };
}
type Document = { copy: WebsiteCopy; design: SiteDesign };
type Panel = "design" | "content" | "images" | "products" | "sections";
const PANELS: { id: Panel; label: string; icon: "palette" | "pencil" | "image" | "store" | "list" }[] = [
  { id: "design", label: "Design", icon: "palette" }, { id: "content", label: "Page content", icon: "pencil" }, { id: "images", label: "Images", icon: "image" }, { id: "products", label: "Products", icon: "store" }, { id: "sections", label: "Sections", icon: "list" },
];
const same = (a: Document, b: Document) => JSON.stringify(a) === JSON.stringify(b);
const SMALL = "flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:opacity-40";
const BLOCK = "flex flex-col gap-4 border-b border-line pb-6";
const fieldNames = { headline: "Headline", subheadline: "Supporting sentence", intro: "Introduction", about: "Your story", howToBuy: "How to order or book", contact: "Contact introduction", seoTitle: "Search title", seoDescription: "Search description" } as const;
const limits = { headline: 80, subheadline: 160, intro: 800, about: 1500, howToBuy: 1200, contact: 600, seoTitle: 60, seoDescription: 160 };
function baseTheme(design: SiteDesign): SiteTheme {
  return design.theme ?? { name: "Your brand direction", rationale: "", layout: "split", font: "sans", background: "#fffefb", foreground: "#202e29", surface: "#f1f3ec", accent: design.color, radius: 10, titleScale: 0.9, density: "balanced", catalogLayout: "grid", imageShape: "square", sectionOrder: [...SITE_SECTIONS] };
}

export function WebsiteEditor(props: WebsiteEditorProps) {
  const router = useRouter();
  const incoming = { copy: props.copy, design: props.design };
  const [baseline, setBaseline] = useState(incoming);
  const [history, setHistory] = useState<{ past: Document[]; present: Document; future: Document[] }>({ past: [], present: incoming, future: [] });
  const [seen, setSeen] = useState(props.revision);
  const [writeRevision, setWriteRevision] = useState(props.revision);
  const [conflict, setConflict] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("design");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [full, setFull] = useState(false);
  const [request, setRequest] = useState("");
  const [status, setStatus] = useState<"idle" | "designing" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const [reset, setReset] = useState(0);
  const doc = history.present;
  const dirty = !same(doc, baseline);
  const busy = status === "designing" || status === "saving";
  if (seen !== props.revision) {
    setSeen(props.revision);
    if (!dirty || status === "saving") {
      setBaseline(incoming); setHistory({ past: [], present: incoming, future: [] }); setWriteRevision(props.revision); setConflict(false); setReset((value) => value + 1);
    } else setConflict(true);
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: Document) {
    setHistory((before) => same(before.present, next) ? before : { past: [...before.past.slice(-39), before.present], present: next, future: [] });
    setStatus("idle"); setError(null);
  }
  const design = (patch: Partial<SiteDesign>) => change({ ...doc, design: { ...doc.design, ...patch } });
  const words = (patch: Partial<WebsiteCopy>) => change({ ...doc, copy: { ...doc.copy, ...patch } });
  const theme = baseTheme(doc.design);
  const style = (patch: Partial<SiteTheme>) => design({ theme: { ...theme, ...patch }, ...(patch.accent ? { color: patch.accent } : {}) });
  const shown = withProducts(doc.copy, props.products, doc.design);
  const html = renderSite({ name: props.name, copy: shown.copy, design: shown.design, images: { ...props.images, photos: Object.fromEntries(props.library.map((image) => [image.id, image])) }, contact: props.contact, year: props.year, highlightNotes: true, anchorBase: "about:srcdoc" });
  const hero = props.library.find((image) => image.id === doc.design.heroImage?.versionId);

  function item(name: string, patch: Partial<SiteItem>) {
    const before = itemFor(doc.design, name) ?? { name, priceCents: null, buyUrl: "", photo: null };
    design({ items: [...doc.design.items.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), { ...before, ...patch }] });
  }
  function travel(direction: "undo" | "redo") {
    setHistory((before) => {
      if (direction === "undo" && before.past.length) return { past: before.past.slice(0, -1), present: before.past.at(-1)!, future: [before.present, ...before.future] };
      if (direction === "redo" && before.future.length) return { past: [...before.past, before.present], present: before.future[0], future: before.future.slice(1) };
      return before;
    });
    setInvalid({}); setReset((value) => value + 1); setStatus("idle");
  }
  async function save() {
    if (busy || conflict) return;
    if (Object.values(invalid).some(Boolean)) { setPanel("products"); setError("Check the highlighted prices before saving."); return; }
    setStatus("saving"); setError(null);
    try {
      const result = await saveWebsiteBuilderAction({ ...doc, revision: writeRevision });
      if (!result.ok) { setError(result.message); setStatus("idle"); return; }
      setStatus("saved");
    } catch { setError(failedMessage()); setStatus("idle"); }
  }
  async function approveCopy() {
    setStatus("saving"); setError(null);
    try {
      const result = await saveWebsiteCopyAction({ copy: doc.copy, approve: true, draftedAt: props.draftedAt });
      if (!result.ok) setError(result.message);
      setStatus(result.ok ? "saved" : "idle");
    } catch { setError(failedMessage()); setStatus("idle"); }
  }
  async function buildTheme() {
    setStatus("designing"); setError(null);
    try {
      const result = await designThemeAction(request, doc);
      if (!result.ok) { setError(result.message); return; }
      const image = props.library.find((image) => image.id === result.value.heroId);
      change({ copy: { ...doc.copy, ...(result.value.heroCopy ?? {}) }, design: { ...doc.design, theme: result.value.theme, color: result.value.theme.accent, heroImage: image ? { photoId: image.photoId, versionId: image.id } : null, showHero: Boolean(image) } });
    } catch { setError(failedMessage()); }
    finally { setStatus("idle"); }
  }
  const inspect = useCallback((target: string) => {
    if (target === "hero") setPanel("images");
    else if (target.startsWith("product:")) { setSelectedProduct(target.slice(8)); setPanel("products"); }
    else setPanel("content");
    setMobilePreview(false);
    window.setTimeout(() => { window.focus(); document.getElementById(`editor-${target}`)?.focus(); }, 0);
  }, []);
  function leave() { if (!dirty || window.confirm("Leave without saving this draft?")) router.push("/website"); }

  return <div className="fixed inset-0 z-[70] flex flex-col bg-ground text-ink" role="region" aria-label="Website editor">
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><button type="button" className={SMALL} disabled={busy} onClick={leave} aria-label="Back to website setup">←</button><div className="min-w-0"><h1 className="truncate text-base font-semibold">{props.name}</h1><p className="text-xs text-muted">Website editor · Private draft</p></div></div>
      <div className="flex items-center gap-2"><span role="status" className="hidden text-xs text-muted sm:block">{busy ? status === "saving" ? "Saving…" : "Creating your design…" : dirty ? "Unsaved changes" : status === "saved" ? "All changes saved" : "Saved draft"}</span><button type="button" className={`${SMALL} hidden sm:flex`} disabled={!history.past.length || busy} onClick={() => travel("undo")} aria-label="Undo change">↶</button><button type="button" className={`${SMALL} hidden sm:flex`} disabled={!history.future.length || busy} onClick={() => travel("redo")} aria-label="Redo change">↷</button><button type="button" className={SMALL} onClick={() => setFull(true)}>Preview ↗</button><button type="button" data-writes className={`${PRIMARY} min-h-10 px-4 text-sm`} disabled={busy || !dirty || conflict} onClick={save}>{status === "saving" ? "Saving…" : "Save draft"}</button></div>
    </header>
    {props.simulated || doc.design.theme?.simulated ? <div className="shrink-0 px-4 py-2"><PracticeBanner what="This website draft uses offline suggestions." /></div> : null}
    {error || conflict ? <div role="alert" className="flex items-center justify-between gap-4 border-b border-danger/20 bg-danger-tint px-5 py-3 text-sm text-danger">{conflict ? "A newer version was saved in another tab. Reload to keep those changes." : error}{conflict ? <button type="button" onClick={() => { if (window.confirm("Reload and discard your unsaved changes?")) window.location.reload(); }} className="font-bold underline">Reload</button> : <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button>}</div> : null}
    <nav aria-label="Website editing tools" className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">{PANELS.map((tab) => <button key={tab.id} type="button" aria-pressed={panel === tab.id && !mobilePreview} onClick={() => { setPanel(tab.id); setMobilePreview(false); }} className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${panel === tab.id && !mobilePreview ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}><Icon name={tab.icon} size="sm" />{tab.label}</button>)}</div>
      <button type="button" className="shrink-0 text-sm font-semibold text-accent lg:hidden" onClick={() => setMobilePreview((value) => !value)}>{mobilePreview ? "Show controls" : "Show canvas"}</button>
    </nav>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside aria-label={`${PANELS.find((tab) => tab.id === panel)!.label} controls`} className={`${mobilePreview ? "hidden lg:block" : "block"} overflow-y-auto border-r border-line bg-surface p-5 pb-16`}>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
          {panel === "design" ? <>
            <div className={BLOCK}><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-accent">Your brand, made into a website</p><h2 className="mt-2 text-xl font-semibold leading-snug">Start with a strong direction.</h2><p className="mt-2 text-sm leading-relaxed text-muted">Your brand, products and imagery shape the design. Tell SnapStart what you want to change.</p></div>
              <label className="flex flex-col gap-2 text-sm font-semibold">Design brief<textarea id="editor-brief" className={`${INPUT} min-h-28 font-normal`} maxLength={1000} value={request} onChange={(event) => setRequest(event.target.value)} placeholder="For example: a warm, contemporary music studio. Lead with the room photo, clear lesson cards and inviting blue accents." /></label>
              <button type="button" data-writes disabled={busy} className={PRIMARY} onClick={buildTheme}>{status === "designing" ? "Designing your website…" : "Design my theme from brand"}<span aria-hidden="true">✦</span></button>
              <div className="flex flex-wrap gap-2">{["More editorial", "Bolder and more colorful", "Simpler and calmer"].map((hint) => <button key={hint} type="button" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent" onClick={() => setRequest(hint)}>{hint}</button>)}</div>
              {doc.design.theme ? <div className="rounded-xl bg-soft p-4"><h3 className="text-sm font-semibold">{theme.name}</h3><p className="mt-2 text-xs leading-relaxed text-muted">{theme.rationale}</p></div> : null}
            </div>
            <div className={BLOCK}><PanelTitle title="Composition" description="Choose the opening that works with your imagery." /><div className="grid grid-cols-3 gap-2">{([['split', 'Split'], ['cover', 'Photo cover'], ['centered', 'Editorial']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={theme.layout === value} onClick={() => style({ layout: value })} className={`rounded-xl border p-2 text-xs font-semibold ${theme.layout === value ? "border-accent bg-accent-tint text-accent" : "border-line"}`}><span aria-hidden="true" className={`mb-2 flex h-12 items-center justify-center rounded-md ${value === "cover" ? "bg-accent text-white" : "bg-wash text-muted"}`}>{value === "split" ? "▤ ▧" : value === "cover" ? "▧" : "▤"}</span>{label}</button>)}</div></div>
            <div className={BLOCK}><PanelTitle title="Typography" /><Select label="Heading style" value={theme.font} onChange={(font) => style({ font: font as SiteTheme["font"] })} options={[["sans", "Modern sans serif"], ["serif", "Classic serif"], ["editorial", "Editorial serif"]]} /><label className="flex flex-col gap-2 text-sm">Headline size<input aria-label="Headline size" type="range" min="0.7" max="1.2" step="0.05" value={theme.titleScale} onChange={(event) => style({ titleScale: Number(event.target.value) })} className="accent-accent" /></label></div>
            <div className={BLOCK}><PanelTitle title="Color palette" description="A cohesive palette, with a clear action color." />{([['background', 'Page'], ['foreground', 'Text'], ['surface', 'Sections'], ['accent', 'Buttons']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between text-sm"><span>{label}</span><span className="flex items-center gap-2 font-mono text-xs text-muted">{theme[key]}<input type="color" aria-label={`${label} color`} value={theme[key]} onChange={(event) => style({ [key]: event.target.value })} className="size-9 cursor-pointer rounded-lg" /></span></label>)}{props.brandColors.length ? <div className="flex flex-wrap gap-2">{props.brandColors.map((color) => <button key={color.hex} type="button" aria-label={`Use ${color.name} for buttons`} title={color.name} className="size-8 rounded-full border border-line shadow-sm" style={{ background: color.hex }} onClick={() => style({ accent: color.hex })} />)}</div> : null}</div>
            <div className={BLOCK}><PanelTitle title="Finishing touches" /><Select label="Page spacing" value={theme.density ?? "balanced"} onChange={(density) => style({ density: density as SiteTheme["density"] })} options={[["compact", "Compact"], ["balanced", "Balanced"], ["airy", "Spacious"]]} /><label className="flex flex-col gap-2 text-sm">Corner softness<input aria-label="Corner softness" type="range" min="0" max="40" value={theme.radius} onChange={(event) => style({ radius: Number(event.target.value) })} className="accent-accent" /></label></div>
          </> : null}
          {panel === "content" ? <>
            <PanelTitle title="Make every word yours." description="Click text on the canvas to edit it here. Changes appear immediately." />
            {(["headline", "subheadline", "intro", "about", "howToBuy", "contact"] as const).map((key) => <TextField key={key} id={`editor-${key}`} label={fieldNames[key]} value={doc.copy[key]} limit={limits[key]} onChange={(value) => words({ [key]: value })} />)}
            <div className="rounded-xl border border-line bg-soft p-4"><h3 className="text-sm font-semibold">{props.approved && !dirty ? "Page content approved" : "Review your page content"}</h3><p className="my-3 text-xs leading-relaxed text-muted">Save your changes, check the full preview, then approve the words before launch.</p><button type="button" data-writes disabled={busy || dirty || props.approved} className={SMALL} onClick={approveCopy}>{props.approved ? "Approved" : "Approve page content"}</button></div>
            <details className={BLOCK}><summary className="cursor-pointer text-sm font-semibold">Frequently asked questions · {doc.copy.faq.length}</summary><div className="mt-4 flex flex-col gap-4">{doc.copy.faq.map((faq, index) => <div key={index} className="flex flex-col gap-3 rounded-xl bg-soft p-3"><TextField label={`Question ${index + 1}`} value={faq.question} limit={150} onChange={(question) => words({ faq: doc.copy.faq.map((entry, i) => i === index ? { ...entry, question } : entry) })} /><TextField label={`Answer ${index + 1}`} value={faq.answer} limit={500} onChange={(answer) => words({ faq: doc.copy.faq.map((entry, i) => i === index ? { ...entry, answer } : entry) })} /><button type="button" className="self-start text-xs text-danger" onClick={() => words({ faq: doc.copy.faq.filter((_, i) => i !== index) })}>Remove question</button></div>)}<button type="button" className={SMALL} disabled={doc.copy.faq.length >= 8} onClick={() => words({ faq: [...doc.copy.faq, { question: "", answer: "" }] })}>+ Add a question</button></div></details>
            <details className={BLOCK}><summary className="cursor-pointer text-sm font-semibold">Search appearance</summary><div className="mt-4 flex flex-col gap-4"><TextField label="Search title" value={doc.copy.seoTitle} limit={60} onChange={(seoTitle) => words({ seoTitle })} /><TextField label="Search description" value={doc.copy.seoDescription} limit={160} onChange={(seoDescription) => words({ seoDescription })} /><div className="rounded-xl border border-line p-3"><p className="truncate text-sm text-accent">{doc.copy.seoTitle || props.name}</p><p className="mt-1 text-xs text-muted">{doc.copy.seoDescription || "Add a short description of this business."}</p></div></div></details>
          </> : null}
          {panel === "images" ? <>
            <PanelTitle title="Give the page a point of view." description="Use your brand imagery, product photos or an original upload." />
            {hero ? <div className="overflow-hidden rounded-xl border border-line"><img src={thumbnail(hero)} alt="Selected header image" className="aspect-video w-full object-cover" /><p className="px-3 py-2 text-xs text-muted">{hero.title}</p></div> : null}
            <Select label="Opening photos" value={doc.design.heroComposition ?? "collection"} onChange={(value) => design({ heroComposition: value as "collection" | "single" })} options={[["collection", "Product collection"], ["single", "Single photo"]]} />
            <ImagePicker images={props.library} selected={doc.design.heroImage?.versionId ?? ""} onChange={(image) => design({ heroImage: image ? { photoId: image.photoId, versionId: image.id } : null, showHero: Boolean(image) })} label="Header image" />
            <Select label="Image focus" value={doc.design.imagePosition ?? "center"} onChange={(imagePosition) => design({ imagePosition: imagePosition as SiteDesign["imagePosition"] })} options={[["center", "Center"], ["top", "Top"], ["bottom", "Bottom"]]} />
            <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">+ Upload an image</summary><div className="mt-4"><LibraryUpload groups={["brand_images"]} initialGroup="brand_images" maxBytes={4_000_000} /></div></details>
            <a className={`${TEXT_LINK} text-sm`} href="/brand-library" target="_blank" rel="noopener noreferrer">Open Brand Library ↗</a>
          </> : null}
          {panel === "products" ? <>
            <PanelTitle title="Your catalog, on your site." description="Names and prices come from your product library. Choose what to show and how to present it." />
            <Select label="Catalog layout" value={theme.catalogLayout ?? "grid"} onChange={(catalogLayout) => style({ catalogLayout: catalogLayout as SiteTheme["catalogLayout"] })} options={[["grid", "Collection grid"], ["featured", "Featured collection"], ["list", "Service list"]]} />
            <Select label="Product image shape" value={theme.imageShape ?? "square"} onChange={(imageShape) => style({ imageShape: imageShape as SiteTheme["imageShape"] })} options={[["square", "Square"], ["portrait", "Portrait"], ["landscape", "Landscape"]]} />
            {props.products.map((product) => <label key={product.id} className="flex items-center justify-between gap-3 text-sm"><span>{product.name}</span><input aria-label={`Show ${product.name}`} type="checkbox" className="size-4 accent-accent" checked={!doc.design.hiddenProducts.includes(product.id)} onChange={(event) => design({ hiddenProducts: event.target.checked ? doc.design.hiddenProducts.filter((id) => id !== product.id) : [...doc.design.hiddenProducts, product.id] })} /></label>)}
            {!shown.copy.offerings.length ? <div className="rounded-xl bg-soft p-4 text-sm text-muted">Add your products or services to bring them into the site.</div> : null}
            {shown.copy.offerings.map((offering) => {
              const current = itemFor(doc.design, offering.name);
              const effective = itemFor(shown.design, offering.name);
              return <details key={offering.name} open={selectedProduct === offering.name} onToggle={(event) => { if (event.currentTarget.open) setSelectedProduct(offering.name); else setSelectedProduct((current) => current === offering.name ? null : current); }} className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">{offering.name}</summary><div className="mt-4 flex flex-col gap-4"><MoneyField key={`${offering.name}:${reset}`} value={current?.priceCents ?? null} source={effective?.priceCents ?? null} onChange={(priceCents, bad) => { setInvalid((before) => ({ ...before, [offering.name]: bad })); if (!bad) item(offering.name, { priceCents }); }} /><TextField id={`editor-product:${offering.name}`} label="Website description" value={current?.description ?? offering.description} limit={300} onChange={(description) => item(offering.name, { description })} /><label className="flex flex-col gap-2 text-sm font-semibold">Payment link<input className={INPUT} type="url" value={current?.buyUrl ?? ""} maxLength={500} placeholder="https://square.link/…" onChange={(event) => item(offering.name, { buyUrl: event.target.value })} /></label><ImagePicker images={props.library} selected={effective?.photo?.versionId ?? ""} label={`Photo for ${offering.name}`} onChange={(image) => item(offering.name, { photo: image ? { photoId: image.photoId, versionId: image.id } : null, hidePhoto: !image })} /></div></details>;
            })}
            <a href="/products" target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} text-sm`}>Manage product library ↗</a>
          </> : null}
          {panel === "sections" ? <>
            <PanelTitle title="Tell the story in the right order." description="Move sections and choose what belongs on the page." />
            {[...new Set([...(theme.sectionOrder ?? []), ...SITE_SECTIONS])].map((section, index, order) => <div key={section} className="flex items-center gap-2 rounded-xl border border-line p-3"><input type="checkbox" aria-label={`Show ${SECTION_LABELS[section]} section`} checked={!doc.design.hidden.includes(section)} className="size-4 accent-accent" onChange={(event) => design({ hidden: event.target.checked ? doc.design.hidden.filter((id) => id !== section) : [...doc.design.hidden, section] })} /><span className="flex-1 text-sm">{SECTION_LABELS[section]}</span><button type="button" aria-label={`Move ${SECTION_LABELS[section]} up`} disabled={index === 0} className="p-1 text-muted disabled:opacity-20" onClick={() => { const next = [...order]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; style({ sectionOrder: next }); }}>↑</button><button type="button" aria-label={`Move ${SECTION_LABELS[section]} down`} disabled={index === order.length - 1} className="p-1 text-muted disabled:opacity-20" onClick={() => { const next = [...order]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; style({ sectionOrder: next }); }}>↓</button></div>)}
            {([['catalog', 'Collection heading'], ['about', 'Story heading'], ['order', 'Ordering heading'], ['contact', 'Contact heading']] as const).map(([key, label]) => <TextField key={key} label={label} value={doc.design.labels?.[key] ?? ""} limit={60} onChange={(value) => design({ labels: { catalog: "", about: "", order: "", contact: "", ...doc.design.labels, [key]: value } })} />)}
            <label className="flex items-center justify-between text-sm">Show business logo<input type="checkbox" className="size-4 accent-accent" checked={doc.design.showLogo} onChange={(event) => design({ showLogo: event.target.checked })} /></label>
            {props.contact.email ? <label className="flex items-center justify-between text-sm">Email button<input type="checkbox" className="size-4 accent-accent" checked={doc.design.showEmail} onChange={(event) => design({ showEmail: event.target.checked })} /></label> : null}
            {props.contact.phone ? <label className="flex items-center justify-between text-sm">Phone button<input type="checkbox" className="size-4 accent-accent" checked={doc.design.showPhone} onChange={(event) => design({ showPhone: event.target.checked })} /></label> : null}
            <details className="rounded-xl bg-soft p-4"><summary className="cursor-pointer text-sm font-semibold">Before you launch</summary><div className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-muted"><p>Save your draft, then review your page content and website setup.</p>{props.checks.blockers.map((message) => <p key={message}>• {message}</p>)}{props.checks.notes.map((message) => <p key={message}>• {message}</p>)}<a href="/website" onClick={(event) => { event.preventDefault(); leave(); }} className={TEXT_LINK}>Review website setup →</a></div></details>
          </> : null}
        </fieldset>
      </aside>
      <section aria-label="Website canvas" className={`${mobilePreview ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col bg-wash`}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2.5"><div className="flex rounded-lg border border-line bg-surface p-1"><button type="button" aria-pressed={device === "desktop"} className={`rounded-md px-3 py-1 text-xs font-semibold ${device === "desktop" ? "bg-soft text-accent" : "text-muted"}`} onClick={() => setDevice("desktop")}>Desktop</button><button type="button" aria-pressed={device === "phone"} className={`rounded-md px-3 py-1 text-xs font-semibold ${device === "phone" ? "bg-soft text-accent" : "text-muted"}`} onClick={() => setDevice("phone")}>Phone</button></div><span className="truncate text-xs text-muted">{props.domain ?? "Your website preview"}</span><span className="hidden text-xs text-muted xl:inline">Click on the page to edit</span></div>
        {status === "designing" ? <div role="status" className="border-b border-line bg-accent-tint px-4 py-3 text-center text-sm text-accent">Shaping your layout, typography, palette and imagery around your brand…</div> : null}
        <Canvas html={html} name={props.name} device={device} onInspect={inspect} />
      </section>
    </div>
    {full ? <FullScreenPreview html={html} name={props.name} onClose={() => setFull(false)} /> : null}
  </div>;
}

function thumbnail(image: BuilderImage) { return `/website/image?${new URLSearchParams({ key: image.id, photo: image.photoId })}`; }
function PanelTitle({ title, description }: { title: string; description?: string }) { return <div><h2 className="text-lg font-semibold leading-snug">{title}</h2>{description ? <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p> : null}</div>; }
function TextField({ id, label, value, onChange, limit }: { id?: string; label: string; value: string; onChange: (value: string) => void; limit: number }) {
  return <label className="flex flex-col gap-2 text-sm font-semibold">{label}<textarea id={id} aria-label={label} rows={value.length > 180 ? 5 : value.length > 75 ? 3 : 2} className={`${INPUT} resize-y font-normal leading-relaxed`} maxLength={limit} value={value} onChange={(event) => onChange(event.target.value)} /><span className="self-end text-[10px] font-normal text-faint">{value.length}/{limit}</span></label>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) { return <label className="flex flex-col gap-2 text-sm font-semibold">{label}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={`${INPUT} font-normal`}>{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>; }
function MoneyField({ value, source, onChange }: { value: number | null; source: number | null; onChange: (cents: number | null, invalid: boolean) => void }) {
  const [raw, setRaw] = useState(value === null ? "" : String(value / 100));
  const invalid = raw.trim() !== "" && parseDollars(raw) === null;
  return <label className="flex flex-col gap-2 text-sm font-semibold">Website price<input aria-label="Website price" inputMode="decimal" maxLength={12} value={raw} placeholder={source === null ? "No price shown" : `Catalog price: ${dollars(source)}`} aria-invalid={invalid} className={INPUT} onChange={(event) => { setRaw(event.target.value); onChange(event.target.value.trim() ? parseDollars(event.target.value) : null, Boolean(event.target.value.trim()) && parseDollars(event.target.value) === null); }} />{invalid ? <span className="text-xs font-normal text-danger">Use a price like 12 or 12.50.</span> : <span className="text-xs font-normal text-muted">Leave blank to use the catalog price.</span>}</label>;
}
export function ImagePicker({ images, selected, label, onChange }: { images: BuilderImage[]; selected: string; label: string; onChange: (image: BuilderImage | null) => void }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const found = images.filter((image) => image.title.toLowerCase().includes(query.toLowerCase()));
  return <fieldset className="flex min-w-0 flex-col gap-3"><legend className="mb-3 text-sm font-semibold">{label}</legend>{images.length > 6 ? <input aria-label={`Search ${label.toLowerCase()}`} className={INPUT} placeholder="Search your images" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}<div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-1"><button type="button" aria-label={`No ${label.toLowerCase()}`} aria-pressed={!selected} onClick={() => onChange(null)} className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-xs ${!selected ? "border-accent bg-accent-tint text-accent" : "border-line text-muted"}`}><span className="text-lg">×</span>None</button>{found.slice(0, limit).map((image) => <button key={image.id} type="button" aria-label={`Use ${image.title} for ${label.toLowerCase()}`} aria-pressed={selected === image.id} title={image.title} onClick={() => onChange(image)} className={`relative aspect-square overflow-hidden rounded-lg border-2 ${selected === image.id ? "border-accent ring-2 ring-accent/20" : "border-transparent"}`}><img src={thumbnail(image)} alt={image.title} loading="lazy" decoding="async" className="size-full object-cover" />{selected === image.id ? <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-xs text-white">✓</span> : null}</button>)}</div>{found.length > limit ? <button type="button" className="text-sm font-semibold text-accent" onClick={() => setLimit((value) => value + 12)}>Show more images</button> : null}{!images.length ? <p className="text-xs text-muted">Upload an image or add one to your Brand Library to get started.</p> : null}</fieldset>;
}
function Canvas({ html, name, device, onInspect }: { html: string; name: string; device: "desktop" | "phone"; onInspect: (target: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [room, setRoom] = useState({ width: 1000, height: 700 });
  const [settledHtml, setSettledHtml] = useState(html);
  const scroll = useRef(0);
  const width = device === "phone" ? 390 : 1280;
  const scale = Math.min(1, Math.max(1, room.width - 40) / width);
  useEffect(() => { const timer = window.setTimeout(() => setSettledHtml(html), 160); return () => window.clearTimeout(timer); }, [html]);
  useEffect(() => { if (!box.current) return; const observer = new ResizeObserver(([entry]) => setRoom({ width: entry.contentRect.width, height: entry.contentRect.height })); observer.observe(box.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let detach = () => {};
    function connect() {
      detach();
      const document = iframe!.contentDocument;
      if (!document?.body) return;
      const hint = document.createElement("style");
      hint.textContent = '[data-edit]:hover{outline:2px solid #0e7490;outline-offset:6px;cursor:text}[data-product]:hover,[data-edit="hero"]:hover{outline:2px solid #0e7490;outline-offset:4px;cursor:pointer}';
      document.head.append(hint);
      const view = document.defaultView;
      view?.scrollTo(0, scroll.current);
      const remember = () => { scroll.current = view?.scrollY ?? 0; };
      const click = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const link = target.closest("a");
        if (link) {
          event.preventDefault();
          const hash = link.getAttribute("href")?.split("#")[1];
          if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
        }
        const product = target.closest<HTMLElement>("[data-product]");
        const editable = target.closest<HTMLElement>("[data-edit]");
        if (product) onInspect(`product:${product.dataset.product}`);
        else if (editable?.dataset.edit) { event.preventDefault(); onInspect(editable.dataset.edit); }
      };
      view?.addEventListener("scroll", remember, { passive: true });
      document.addEventListener("click", click);
      detach = () => { hint.remove(); view?.removeEventListener("scroll", remember); document.removeEventListener("click", click); };
    }
    iframe.addEventListener("load", connect);
    connect();
    return () => { iframe.removeEventListener("load", connect); detach(); };
  }, [onInspect]);
  return <div ref={box} className="relative min-h-0 flex-1 overflow-hidden"><iframe ref={frame} title={`Canvas for ${name}`} srcDoc={settledHtml} sandbox="allow-same-origin" className="absolute top-5 rounded-lg border-0 bg-white shadow-xl" style={{ width, height: Math.max(300, room.height - 40) / scale, left: Math.max(0, (room.width - width * scale) / 2), transform: `scale(${scale})`, transformOrigin: "top left" }} /></div>;
}
