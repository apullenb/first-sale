// Legal terms owners meet on forms, in plain words; the legal term stays because the forms use it

export interface PlainWord {
  term: string;
  plain: string;
}

export const PLAIN_WORDS: PlainWord[] = [
  { term: "registered agent", plain: "A registered agent is the person or company that accepts legal mail for your business. It can be you." },
  { term: "certificate of formation", plain: "A certificate of formation is the form that creates your LLC or corporation with the state." },
  { term: "articles of organization", plain: "Articles of organization are the form that creates an LLC with your state." },
  { term: "articles of incorporation", plain: "Articles of incorporation are the form that creates a corporation with your state." },
  { term: "assumed name", plain: "An assumed name is a name you sell under that isn’t the business’s legal name, also called a DBA." },
  { term: "organizer", plain: "The organizer is the person who signs and sends the form that creates the LLC." },
  { term: "EIN", plain: "An EIN is a free tax ID number for your business from the IRS." },
];

const pattern = (term: string) => new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, term === term.toUpperCase() ? "" : "i");

// Adds plain words after the sentence where each term first shows on a page; `explained` is shared by the whole page
export function explainTerms(text: string, explained: Set<string>): string {
  let out = text;
  for (const { term, plain } of PLAIN_WORDS) {
    if (explained.has(term)) continue;
    const match = pattern(term).exec(out);
    if (!match) continue;
    explained.add(term);
    if (out.includes(plain)) continue;
    const rest = out.slice(match.index);
    const stop = /[.!?](\s|$)/.exec(rest);
    const end = stop ? match.index + stop.index + 1 : out.length;
    out = `${out.slice(0, end)}${stop ? "" : "."} ${plain}${out.slice(end)}`;
  }
  return out;
}

// The terms in a title, for a plain-words line under it
export function termsIn(text: string, explained: Set<string>): PlainWord[] {
  return PLAIN_WORDS.filter((word) => {
    if (explained.has(word.term) || !pattern(word.term).test(text)) return false;
    explained.add(word.term);
    return true;
  });
}
