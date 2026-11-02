import { z } from "zod";
import type { SquareItem } from "@/lib/square/client";

export const descriptionSchema = z.string().trim().min(1).max(300);
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const CONNECTIVES = new Set("a an the and or with for of in on to is are this that it its your you our from at as by made enjoy discover meet featuring offers offering has have each these those into bring brings adds add touch simple description product".split(" "));

export function originalDescription(item: SquareItem): string {
  return item.item_data.description_plaintext ?? item.item_data.description ?? "";
}

export function descriptionProblems(description: string, item: SquareItem): string[] {
  if (!descriptionSchema.safeParse(description).success) return ["Write a description between 1 and 300 characters."];
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(description)) return ["Use plain text, without markup or control characters."];
  const evidence = `${item.item_data.name} ${originalDescription(item)}`;
  if (/\b(?:organic|non[ -]?toxic|hypoallergenic|gluten[ -]?free|cures?|treats?|prevents?|guaranteed|certified|free shipping|delivery|discount)\b|[$€£%]/i.test(description)) {
    return ["Health, safety, certification, pricing and delivery claims need a separate review in Square."];
  }
  if (/\b(?:no|not|never|without|free of)\b/i.test(evidence) && description.trim() !== originalDescription(item).trim()) {
    return ["This product has a qualification or exclusion. Edit its description in Square so that meaning stays intact."];
  }
  const allowed = new Set(words(evidence));
  const added = [...new Set(words(description).filter((word) => !allowed.has(word) && !CONNECTIVES.has(word)))];
  if (added.length) return [`Use only the product’s existing facts. These words need facts added in Square first: ${added.slice(0, 12).join(", ")}.`];
  return [];
}

export function descriptionUpdate(item: SquareItem, description: string): SquareItem {
  const data = { ...item.item_data };
  delete data.description;
  delete data.description_plaintext;
  const escaped = description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>");
  return { ...item, item_data: { ...data, description_html: escaped } };
}
