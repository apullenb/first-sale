import { parse } from "node-html-parser";

// Visible text of an HTML email, without scripts or styles
export function plainEmail(html: string) {
  const root = parse(html);
  root
    .querySelectorAll("script,style,iframe,object,head")
    .forEach((element) => element.remove());
  root.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  root
    .querySelectorAll("p,div,tr,blockquote,h1,h2,h3,li")
    .forEach((element) => element.insertAdjacentHTML("beforeend", "\n"));
  return root.textContent
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 60_000);
}
