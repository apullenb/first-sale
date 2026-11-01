// Legal terms owners meet on forms, in plain words; the legal term stays because the forms use it

export interface PlainWord {
  term: string;
  plain: string;
  // Only explained when the text or the page's context matches
  when?: RegExp;
  // Words just before the term that give it another meaning, e.g. "market organizer"
  notAfter?: RegExp;
}

const FORMING_ENTITY =
  /\b(LLCs?|limited liability|corporations?|incorporat\w*|certificate of formation|articles of (organization|incorporation)|form(ing)? (an?|your|the) (company|business entity))\b/i;

export const PLAIN_WORDS: PlainWord[] = [
  { term: "registered agent", plain: "A registered agent is the person or company that accepts legal mail for your business. It can be you." },
  { term: "certificate of formation", plain: "A certificate of formation is the form that creates your LLC or corporation with the state." },
  { term: "articles of organization", plain: "Articles of organization are the form that creates an LLC with your state." },
  { term: "articles of incorporation", plain: "Articles of incorporation are the form that creates a corporation with your state." },
  { term: "assumed name", plain: "An assumed name is a name you sell under that isn’t the business’s legal name, also called a DBA." },
  {
    term: "organizer",
    plain: "The organizer is the person who signs and sends the form that creates the LLC.",
    when: FORMING_ENTITY,
    notAfter: /\b(market|event|events|festival|fair|show|craft|vendor|community|trade|farmers['’]?|pop-up|wedding|party)\s+$/i,
  },
  { term: "EIN", plain: "An EIN is a free tax ID number for your business from the IRS." },
];

const pattern = (term: string, flags = "") =>
  new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, (term === term.toUpperCase() ? "" : "i") + flags);

// First use of the word that means the legal term here
function findTerm(word: PlainWord, text: string, context: string): RegExpExecArray | null {
  if (word.when && !word.when.test(text) && !word.when.test(context)) return null;
  const re = pattern(word.term, "g");
  for (let match = re.exec(text); match; match = re.exec(text)) {
    if (!word.notAfter?.test(text.slice(Math.max(0, match.index - 40), match.index))) return match;
  }
  return null;
}

// Adds plain words after the sentence where each term first shows on a page; `explained` is shared by the whole page.
// `context` is the step and form titles, for terms that only mean the legal thing on some steps.
export function explainTerms(text: string, explained: Set<string>, context = ""): string {
  let out = text;
  for (const word of PLAIN_WORDS) {
    if (explained.has(word.term)) continue;
    const match = findTerm(word, out, context);
    if (!match) continue;
    explained.add(word.term);
    if (out.includes(word.plain)) continue;
    const rest = out.slice(match.index);
    const stop = /[.!?](\s|$)/.exec(rest);
    const end = stop ? match.index + stop.index + 1 : out.length;
    out = `${out.slice(0, end)}${stop ? "" : "."} ${word.plain}${out.slice(end)}`;
  }
  return out;
}

// The terms in a title, for a plain-words line under it
export function termsIn(text: string, explained: Set<string>, context = ""): PlainWord[] {
  return PLAIN_WORDS.filter((word) => {
    if (explained.has(word.term) || !findTerm(word, text, context)) return false;
    explained.add(word.term);
    return true;
  });
}
