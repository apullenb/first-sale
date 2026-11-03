// Text the generated PDFs can print; no file access, so browser code can use it too

// Windows-1252: the characters the PDF fonts carry; anything else becomes "?"
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function toWinAnsi(text: string): string {
  return [...text.normalize("NFC")]
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (char === "\t") return " ";
      if (char === "\r") return "";
      if ((code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(char) || char === "\n") return char;
      if (code === 0x2212 || code === 0x2010 || code === 0x2011) return "-";
      return "?";
    })
    .join("");
}

// Letters the PDF fonts can't draw, which toWinAnsi would print as "?"
export function unprintable(text: string): string[] {
  return [...new Set([...text.normalize("NFC")].filter((char) => char !== "?" && toWinAnsi(char) === "?"))];
}
