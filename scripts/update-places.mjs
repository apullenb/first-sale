// Refreshes src/data/places/places.json from the US Census Bureau's county and place reference files.
// Run: node scripts/update-places.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://www2.census.gov/geo/docs/reference/codes2020/";
const COUNTIES_URL = `${BASE}national_county2020.txt`;
const PLACES_URL = `${BASE}national_place_by_county2020.txt`;
// 50 states and DC; territories aren't covered yet
const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return { text: await response.text(), modified: response.headers.get("last-modified") };
}

function rows(text) {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const keys = header.split("|");
  return lines.map((line) => Object.fromEntries(line.split("|").map((value, i) => [keys[i], value])));
}

// "Franklin County" → "Franklin"; parishes, boroughs and independent cities keep their word
const countyName = (name) => name.replace(/ County$/, "");
// "Columbus city", "Blacklick Estates CDP", "Indianapolis city (balance)" → the place's own name
const placeName = (name) => name.replace(/\s+(?:[a-z][a-z-]*|\(balance\)|CDP)(?:\s+(?:[a-z][a-z-]*|\(balance\)|CDP))*$/, "");

const [counties, places] = await Promise.all([fetchText(COUNTIES_URL), fetchText(PLACES_URL)]);

const states = {};
for (const row of rows(counties.text)) {
  if (!STATES.has(row.STATE)) continue;
  states[row.STATE] ??= { counties: [], places: [] };
  states[row.STATE].counties.push(countyName(row.COUNTYNAME));
}
for (const state of Object.values(states)) state.counties.sort((a, b) => a.localeCompare(b));

// One entry per place, with every county it reaches
const byPlace = new Map();
for (const row of rows(places.text)) {
  // "F" rows are fictitious, except the balance of a consolidated city such as Indianapolis
  if (!STATES.has(row.STATE) || (row.FUNCSTAT === "F" && !row.PLACENAME.endsWith("(balance)"))) continue;
  const key = `${row.STATE}|${row.PLACEFP}`;
  // 1: a city or town government; 0: a Census-designated community with none; 2: inactive or unclear
  const government = row.TYPE !== "INCORPORATED PLACE" ? 0 : ["A", "B", "F"].includes(row.FUNCSTAT) ? 1 : 2;
  const entry = byPlace.get(key) ?? { state: row.STATE, name: placeName(row.PLACENAME), government, counties: new Set() };
  entry.counties.add(countyName(row.COUNTYNAME));
  byPlace.set(key, entry);
}
for (const entry of byPlace.values()) {
  const state = states[entry.state];
  // [name, government (see above), county indexes]
  state.places.push([entry.name, entry.government, [...entry.counties].map((county) => state.counties.indexOf(county)).filter((i) => i >= 0)]);
}
for (const state of Object.values(states)) state.places.sort((a, b) => a[0].localeCompare(b[0]));

const out = {
  // Census 2020 reference files; the dates are when census.gov last changed them
  vintage: "2020 Census",
  asOf: new Date(counties.modified ?? places.modified ?? Date.now()).toISOString().slice(0, 10),
  fetchedAt: new Date().toISOString().slice(0, 10),
  sources: [COUNTIES_URL, PLACES_URL],
  states,
};
mkdirSync(new URL("../src/data/places/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/data/places/places.json", import.meta.url), JSON.stringify(out));
const totals = Object.values(states).reduce((sum, s) => [sum[0] + s.counties.length, sum[1] + s.places.length], [0, 0]);
console.log(`Wrote ${Object.keys(states).length} states, ${totals[0]} counties, ${totals[1]} places (as of ${out.asOf}).`);
