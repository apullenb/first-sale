"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { zipFiles } from "@/lib/brand/archive";
import { kitColors } from "@/lib/brand/colors";
import { KIT_FACTS, KIT_GROUPS, KIT_RECIPES, type KitGroup, type KitRecipe, kitFileName, kitReadme, kitRecipes, type KitSource, safeFileName } from "@/lib/brand/kit-files";
import type { PaletteColor } from "@/lib/brand/types";
import { KitFileError, makeKitFile, saveBlob } from "./kit-maker";

interface Props {
  businessName: string;
  simulated: boolean;
  colors: PaletteColor[];
  // Approved file addresses; null until approved
  sources: Record<KitSource, string | null>;
}

// The usual sign for see-through; it only sits behind the see-through preview
const CHECKERBOARD = "bg-[repeating-conic-gradient(#eef2f6_0_25%,#ffffff_0_50%)] bg-[length:16px_16px]";

const reasonOf = (error: unknown) => (error instanceof KitFileError ? error.message : "Couldn’t make this file in your browser. Try again, or use a different browser.");

// Every file is made in the browser from the approved logo and versions; nothing new is drawn or paid for
export function LogoFiles({ businessName, simulated, colors, sources }: Props) {
  const { ink, dark, darkName } = kitColors(colors);
  const recipes = kitRecipes({ primary: Boolean(sources.primary), stacked: Boolean(sources.stacked), profile: Boolean(sources.profile), solid: Boolean(sources.solid) });
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  type Preview = { url: string | null; problem: string | null };
  const [previews, setPreviews] = useState<{ clear: Preview; light: Preview }>({ clear: { url: null, problem: null }, light: { url: null, problem: null } });
  useLayoutEffect(
    () => () => {
      setProblems({});
      setNote(null);
    },
    [],
  );

  // The see-through logo and the white one-color logo, shown on the backgrounds they're for
  const primary = sources.primary;
  const solid = sources.solid;
  useEffect(() => {
    if (!primary) return;
    let cancelled = false;
    const urls: string[] = [];
    const preview = async (src: string | null, id: string) => {
      const recipe = KIT_RECIPES.find((each) => each.id === id);
      if (!src || !recipe) return null;
      const url = URL.createObjectURL(await makeKitFile(src, recipe, { ink, dark }, simulated));
      urls.push(url);
      return url;
    };
    // Each shows on its own, so one that can't be made doesn't hide the other
    const settled = (result: PromiseSettledResult<string | null>): Preview =>
      result.status === "fulfilled" ? { url: result.value, problem: null } : { url: null, problem: reasonOf(result.reason) };
    void Promise.allSettled([preview(primary, "main-clear"), preview(solid, "solid-white")]).then(([clear, light]) => {
      if (!cancelled) setPreviews({ clear: settled(clear), light: settled(light) });
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [primary, solid, ink, dark, simulated]);

  async function one(recipe: KitRecipe) {
    const src = sources[recipe.source];
    if (!src || busy) return;
    setBusy(recipe.id);
    setProblems((current) => ({ ...current, [recipe.id]: "" }));
    try {
      saveBlob(await makeKitFile(src, recipe, { ink, dark }, simulated), kitFileName(businessName, recipe, simulated));
    } catch (error) {
      setProblems((current) => ({ ...current, [recipe.id]: reasonOf(error) }));
    } finally {
      setBusy(null);
    }
  }

  async function all() {
    if (busy) return;
    setBusy("all");
    setNote(null);
    try {
      const files: { name: string; data: Uint8Array }[] = [];
      const skipped: { recipe: KitRecipe; reason: string }[] = [];
      for (const recipe of recipes) {
        try {
          const blob = await makeKitFile(sources[recipe.source]!, recipe, { ink, dark }, simulated);
          files.push({ name: kitFileName(businessName, recipe, simulated), data: new Uint8Array(await blob.arrayBuffer()) });
        } catch (error) {
          skipped.push({ recipe, reason: reasonOf(error) });
        }
      }
      if (!files.length) throw new Error("Nothing made");
      files.push({ name: "Which file to use.txt", data: new TextEncoder().encode(kitReadme({ businessName, recipes, skipped, simulated, colors })) });
      const zip = zipFiles(files);
      saveBlob(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), `${safeFileName(`${businessName} - logo files${simulated ? " - practice preview" : ""}`)}.zip`);
      setNote(skipped.length ? `${skipped.length} ${skipped.length === 1 ? "file couldn’t" : "files couldn’t"} be made. “Which file to use.txt” in the download says why.` : null);
    } catch {
      setNote("Couldn’t make the files in your browser. Try again, or download them one at a time.");
    } finally {
      setBusy(null);
    }
  }

  const groups = (Object.keys(KIT_GROUPS) as KitGroup[]).filter((group) => recipes.some((recipe) => recipe.group === group));
  const missing = (["stacked", "profile", "solid"] as const).filter((source) => !sources[source]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] text-rule">
          Made in your browser from the logo and versions you approved, at the sizes each place asks for. Nothing new is drawn or charged. See-through files
          are made by removing the plain white background, so white inside your logo becomes see-through too.
        </p>
        {missing.length ? <p className="text-sm text-muted">Approve your logo versions above to add the stacked, icon, one-color, website and social files.</p> : null}
      </div>

      {primary ? (
        <div className="grid gap-3 @2xl:grid-cols-2">
          <figure className="flex flex-col gap-1.5">
            <div className={`flex aspect-[3/2] items-center justify-center rounded-xl border border-line p-4 ${CHECKERBOARD}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {previews.clear.url ? <img src={previews.clear.url} alt="Your logo with a see-through background" className="max-h-full max-w-full" /> : <span className="text-sm text-muted">{previews.clear.problem ?? "Making a preview…"}</span>}
            </div>
            <figcaption className="text-sm text-muted">See-through: the checks show where nothing is.</figcaption>
          </figure>
          {solid ? (
            <figure className="flex flex-col gap-1.5">
              <div className="flex aspect-[3/2] items-center justify-center rounded-xl p-4" style={{ backgroundColor: dark }}>
                {previews.light.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews.light.url} alt="Your one-color logo in white on a dark background" className="max-h-full max-w-full" />
                ) : (
                  <span className="text-sm text-white">{previews.light.problem ?? "Making a preview…"}</span>
                )}
              </div>
              <figcaption className="text-sm text-muted">
                White one-color logo, for dark backgrounds. Shown on {darkName ? `your darkest color, ${darkName} (${dark.toUpperCase()})` : `near-black (${dark.toUpperCase()}), because all your colors are light`}.
              </figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={all} disabled={busy !== null} className={PRIMARY}>
          <Icon name="download" size="sm" />
          {busy === "all" ? "Making your files…" : `Download all ${recipes.length} logo files (.zip)`}
        </button>
        <p className="text-sm text-muted">Includes a note on which file to use where.</p>
        <p role="status" className={note ? "text-sm text-check" : "sr-only"}>
          {note ?? ""}
        </p>
      </div>

      <ul className="grid gap-3 @2xl:grid-cols-2">
        {groups.map((group) => (
          <li key={group} className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
            <div className="flex flex-col gap-0.5">
              <h4 className="font-bold">{KIT_GROUPS[group].title}</h4>
              <p className="text-sm text-muted">{KIT_GROUPS[group].purpose}</p>
            </div>
            <ul className="flex flex-col gap-3">
              {recipes
                .filter((recipe) => recipe.group === group)
                .map((recipe) => (
                  <li key={recipe.id} className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => one(recipe)}
                      disabled={busy !== null}
                      aria-label={busy === recipe.id ? undefined : `${KIT_GROUPS[group].title}, ${recipe.label}`}
                      className={`${SECONDARY} text-left`}
                    >
                      <Icon name="download" size="sm" />
                      {busy === recipe.id ? "Making the file…" : recipe.label}
                    </button>
                    <p className="text-sm text-muted">{recipe.use}</p>
                    {/* Always rendered, so screen readers announce a problem */}
                    <p role="status" className={problems[recipe.id] ? "text-sm text-check" : "sr-only"}>
                      {problems[recipe.id] ?? ""}
                    </p>
                  </li>
                ))}
            </ul>
            {KIT_FACTS[group] ? (
              <div className="flex flex-col gap-1 text-sm text-muted">
                {KIT_FACTS[group].facts.map((fact) => (
                  <p key={fact}>{fact}</p>
                ))}
                <p>
                  Sources:{" "}
                  {KIT_FACTS[group].sources.map((citation, index) => (
                    <span key={citation.url}>
                      {index ? "; " : ""}
                      <a href={citation.url} target="_blank" rel="noreferrer" className={TEXT_LINK}>
                        {citation.name}
                      </a>{" "}
                      (checked {citation.checked})
                    </span>
                  ))}
                  . Sites change their sizes, so check before you upload.
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
