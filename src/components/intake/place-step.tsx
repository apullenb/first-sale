"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { placeOptionsAction } from "@/app/(app)/business/actions";
import { Icon } from "@/components/icons";
import { US_STATE_CODES } from "@/lib/domain";
import type { IntakeAnswers, Mark } from "@/lib/intake/answers";
import { countyLabel, STATE_NAMES } from "@/lib/intake/options";
import type { PlaceOptions } from "@/lib/intake/places";
import { Combobox, type ComboOption } from "./combobox";
import { MarkBadge } from "./question-block";

const STATES: ComboOption[] = US_STATE_CODES.map((code) => ({ value: code, label: STATE_NAMES[code] }));

// State, county and city: type to search, pick a suggestion, or type your own county or city
export function PlaceStep({
  id,
  answers,
  marks,
  onState,
  onText,
  onCityPick,
  errorId,
}: {
  id: (name: string) => string;
  answers: IntakeAnswers;
  marks: Partial<Record<keyof IntakeAnswers, Mark>>;
  onState: (state: IntakeAnswers["state"]) => void;
  onText: (field: "county" | "city", value: string) => void;
  // A picked city, with its county when it sits in just one
  onCityPick: (city: string, county: string | null) => void;
  errorId?: string;
}) {
  const [stateText, setStateText] = useState(answers.state ? STATE_NAMES[answers.state] : "");
  const [places, setPlaces] = useState<{ state: string; options: PlaceOptions } | null>(null);
  const loading = useRef<string | null>(null);

  useEffect(() => {
    const state = answers.state;
    if (!state || places?.state === state || loading.current === state) return;
    loading.current = state;
    placeOptionsAction(state)
      .then((result) => {
        if (result.ok) setPlaces({ state, options: result.value });
      })
      .catch(() => {})
      .finally(() => {
        if (loading.current === state) loading.current = null;
      });
  }, [answers.state, places?.state]);

  const options = places && places.state === answers.state ? places.options : null;
  const counties = useMemo<ComboOption[]>(
    () => (options?.counties ?? []).map((county) => ({ value: county, label: countyLabel(county) })),
    [options],
  );
  const county = answers.county.trim().replace(/\s+county$/i, "").toLowerCase();
  const cities = useMemo<ComboOption[]>(() => {
    const list = (options?.cities ?? []).map((city) => ({
      value: city.id,
      label: city.name,
      detail: [city.counties.map(countyLabel).join(", "), city.noCityGovernment ? "No city government" : ""].filter(Boolean).join(" · ") || undefined,
      inCounty: city.counties.some((c) => c.toLowerCase() === county),
    }));
    // Places in the picked county first
    return [...list.filter((city) => city.inCounty), ...list.filter((city) => !city.inCounty)];
  }, [options, county]);
  const typedCity = answers.city.trim().toLowerCase();
  const matches = typedCity ? (options?.cities ?? []).filter((city) => city.name.toLowerCase() === typedCity) : [];
  const match = matches.length === 1 ? matches[0] : null;
  const hintId = id("place-hint");

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[15px] text-rule">
        <Icon name="globe" size="sm" className="text-accent" />
        <span>
          <span className="font-semibold text-ink">Country:</span> United States. SnapStart works for US businesses for now.
        </span>
      </p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={id("state")} className="text-[15.5px] font-semibold">
              State
            </label>
            <MarkBadge mark={marks.state} />
          </div>
          <Combobox
            id={id("state")}
            value={stateText}
            options={STATES}
            placeholder="Start typing, like Texas"
            describedBy={errorId}
            invalid={Boolean(errorId)}
            onType={(text) => {
              setStateText(text);
              const exact = STATES.find((state) => state.label.toLowerCase() === text.trim().toLowerCase());
              onState(exact ? (exact.value as IntakeAnswers["state"]) : "");
            }}
            onPick={(option) => {
              setStateText(option.label);
              onState(option.value as IntakeAnswers["state"]);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={id("county")} className="text-[15.5px] font-semibold">
              County
            </label>
            <MarkBadge mark={marks.county} />
          </div>
          <Combobox
            id={id("county")}
            value={answers.county}
            options={counties}
            free
            placeholder={answers.state ? "Type or pick" : "Pick a state first"}
            describedBy={hintId}
            onType={(text) => onText("county", text)}
            onPick={(option) => onText("county", option.label)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("city")} className="text-[15.5px] font-semibold">
            City or town
          </label>
          <Combobox
            id={id("city")}
            value={answers.city}
            options={cities}
            free
            placeholder={answers.state ? "Type or pick" : "Pick a state first"}
            describedBy={hintId}
            onType={(text) => onText("city", text)}
            onPick={(option) => {
              const city = options?.cities.find((c) => c.id === option.value);
              onCityPick(option.label, city?.counties.length === 1 ? countyLabel(city.counties[0]) : null);
            }}
          />
        </div>
      </div>
      {match && match.counties.length > 1 && !answers.county.trim() ? (
        <p className="rounded-xl border border-line bg-soft px-4 py-3 text-[15px] text-rule">
          {match.name} reaches more than one county: {match.counties.map(countyLabel).join(", ")}. Pick yours in the County box.
        </p>
      ) : null}
      {match?.noCityGovernment ? (
        <p className="rounded-xl border border-line bg-soft px-4 py-3 text-[15px] text-rule">
          The Census Bureau lists {match.name} as a community with no city government of its own. If that’s where you are, the county’s requirements are the
          ones to check. If your address is inside a nearby city, say so below.
        </p>
      ) : null}
      <p id={hintId} className="text-[14.5px] text-muted">
        {options?.source ?? "Type your county and city, or leave them for later. Requirements can come from each one."}
      </p>
    </div>
  );
}
