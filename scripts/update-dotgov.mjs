// Refreshes src/data/dotgov/domains.json from CISA's official .gov domain list.
// Run: node scripts/update-dotgov.mjs
import { writeFileSync } from "node:fs";

const CSV_URL = "https://raw.githubusercontent.com/cisagov/dotgov-data/main/current-full.csv";
const COMMITS_URL = "https://api.github.com/repos/cisagov/dotgov-data/commits?path=current-full.csv&per_page=1";
// Registry type -> jurisdiction level; election offices, districts and tribes aren't used for business rules
const LEVELS = {
  "Federal": "federal",
  "Federal - Executive": "federal",
  "Federal - Legislative": "federal",
  "Federal - Judicial": "federal",
  "State or territory": "state",
  "County": "county",
  "City": "city",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const csv = await (await fetch(CSV_URL)).text();
const [header, ...rows] = parseCsv(csv);
const col = (name) => {
  const index = header.indexOf(name);
  if (index === -1) throw new Error(`Column "${name}" missing from the registry`);
  return index;
};
const [domain, type, org, suborg, city, state] = [
  "Domain name",
  "Domain type",
  "Organization name",
  "Suborganization name",
  "City",
  "State",
].map(col);

const domains = rows
  .filter((row) => row.length > state && LEVELS[row[type]])
  .map((row) => [
    row[domain].toLowerCase(),
    LEVELS[row[type]],
    row[suborg] ? `${row[suborg]} (${row[org]})` : row[org],
    row[city],
    row[state],
  ])
  .sort((a, b) => a[0].localeCompare(b[0]));

let asOf = new Date().toISOString();
try {
  const [commit] = await (await fetch(COMMITS_URL)).json();
  asOf = commit.commit.committer.date;
} catch {
  console.warn("Couldn't read the registry's update date; using today's.");
}

writeFileSync(
  new URL("../src/data/dotgov/domains.json", import.meta.url),
  JSON.stringify({ asOf, source: "https://github.com/cisagov/dotgov-data", domains }) + "\n",
);
console.log(`${domains.length} domains, registry as of ${asOf}`);
