import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  type PDFRef,
  PDFSignature,
  PDFString,
  PDFHexString,
  PDFTextField,
} from "pdf-lib";
import { extractTextItems, getDocumentProxy } from "unpdf";
import type { DocumentField, DocumentPage, FieldKind } from "./types";

// Text and fillable fields of a PDF, read in code. Scans have little text and go to the AI model instead.

export const MAX_PDF_PAGES = 60;
export const MAX_FORM_FIELDS = 400;

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  hasEOL: boolean;
}

export interface PdfReading {
  totalPages: number;
  pages: DocumentPage[];
  fields: DocumentField[];
  // Under ~40 characters a page: probably a scan or photo
  looksScanned: boolean;
}

export async function readPdf(bytes: Uint8Array): Promise<PdfReading> {
  // pdf.js may take ownership of the buffer it's given
  const proxy = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, items } = await extractTextItems(proxy);
  const pageItems = items.slice(0, MAX_PDF_PAGES) as TextItem[][];
  const pages = pageItems.map((list, index) => ({ number: index + 1, text: joinItems(list) }));
  const chars = pages.reduce((sum, page) => sum + page.text.replace(/\s/g, "").length, 0);
  const fields = await formFields(bytes, pageItems);
  return { totalPages, pages, fields, looksScanned: chars < 40 * Math.max(1, pages.length) };
}

// Text of a PDF page, for reading official pages that turn out to be PDFs
export async function pdfText(bytes: Uint8Array, maxChars: number): Promise<string> {
  const { pages } = await readPdf(bytes);
  return pages
    .map((page) => page.text)
    .join("\n")
    .slice(0, maxChars);
}

function joinItems(items: readonly TextItem[]): string {
  return items
    .map((item) => item.str + (item.hasEOL ? "\n" : ""))
    .join("")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function formFields(bytes: Uint8Array, pageItems: readonly TextItem[][]): Promise<DocumentField[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return [];
  }
  const pageOf = widgetPages(doc);
  const fields: DocumentField[] = [];
  // Enough for any real form; keeps one odd PDF from growing the record without limit
  for (const field of doc.getForm().getFields().slice(0, MAX_FORM_FIELDS)) {
    const kind = fieldKind(field);
    if (!kind) continue;
    const widget = field.acroField.getWidgets()[0];
    const rect = widget?.getRectangle();
    const pageIndex = widget ? (pageOf.get(String(widget.P() ?? "")) ?? findWidgetPage(doc, widget.dict)) : 0;
    const tooltip = decode(field.acroField.dict.get(PDFName.of("TU")));
    const nearby = rect ? labelNear(pageItems[pageIndex] ?? [], rect, kind === "checkbox") : "";
    fields.push({
      id: field.getName(),
      label: tooltip || nearby || readableName(field.getName()),
      page: pageIndex + 1,
      kind,
      options: field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup ? field.getOptions() : [],
      printedText: nearby,
      confidence: "high",
      fillable: kind !== "signature",
    });
  }
  return fields;
}

type AnyField = ReturnType<ReturnType<PDFDocument["getForm"]>["getFields"]>[number];

function fieldKind(field: AnyField): FieldKind | null {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup) return "choice";
  if (field instanceof PDFSignature) return "signature";
  return null;
}

function widgetPages(doc: PDFDocument): Map<string, number> {
  const map = new Map<string, number>();
  doc.getPages().forEach((page, index) => map.set(String(page.ref), index));
  return map;
}

// Widgets without a page pointer: look for them in each page's annotations
function findWidgetPage(doc: PDFDocument, dict: unknown): number {
  const pages = doc.getPages();
  for (let index = 0; index < pages.length; index++) {
    const annots = pages[index].node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i) as PDFRef;
      if (doc.context.lookup(ref) === dict) return index;
    }
  }
  return 0;
}

function decode(value: unknown): string {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText().replace(/\s+/g, " ").trim();
  return "";
}

// "topmostSubform[0].Page1[0].f1_2[0]" -> "f1 2"; only used when nothing better is printed
function readableName(name: string): string {
  const last = name.split(".").at(-1) ?? name;
  return last.replace(/\[\d+\]/g, "").replace(/[_-]+/g, " ").trim() || name;
}

// Printed words just left of the box on the same line, or just above it; right of it for checkboxes
export function labelNear(
  items: readonly TextItem[],
  rect: { x: number; y: number; width: number; height: number },
  checkbox = false,
): string {
  const top = rect.y + rect.height;
  const right = items
    .filter((item) => item.y >= rect.y - 3 && item.y <= top + 2 && item.x >= rect.x + rect.width - 2 && item.x <= rect.x + rect.width + 40)
    .sort((a, b) => a.x - b.x);
  if (checkbox && right.length) return right[0].str.replace(/[\s.]+$/g, "").trim().slice(0, 160);
  const left = items
    .filter((item) => item.y >= rect.y - 2 && item.y <= top && item.x + item.width <= rect.x + 4 && item.x >= rect.x - 260)
    .sort((a, b) => a.x - b.x);
  const above = items
    .filter((item) => item.y > top - 2 && item.y <= top + 14 && item.x < rect.x + rect.width && item.x + item.width > rect.x - 4)
    .sort((a, b) => a.x - b.x);
  const words = (left.length ? left : above).map((item) => item.str.trim()).filter(Boolean);
  return words.join(" ").replace(/\s+/g, " ").slice(0, 160);
}
