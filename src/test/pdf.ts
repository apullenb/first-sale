import { PDFDocument, PDFString, StandardFonts } from "pdf-lib";

// Small PDFs built in-test with pdf-lib

export async function textPdf(pages: readonly string[][]): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([612, 792]);
    lines.forEach((line, index) => page.drawText(line, { x: 50, y: 740 - index * 20, size: 12, font }));
  }
  return new Uint8Array(await doc.save());
}

// Labelled business form: name and address text fields, an LLC checkbox, a state dropdown, a "signature" text box,
// a real signature field, and a second page with an email field. The label sits left of each text field and right of the checkbox.
export async function fillableForm(): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  const first = doc.addPage([612, 792]);
  const second = doc.addPage([612, 792]);

  first.drawText("Business Registration Form", { x: 50, y: 740, size: 16, font });
  first.drawText("This form registers a trade name with the Secretary of State.", { x: 50, y: 715, size: 11, font });

  first.drawText("Business name", { x: 50, y: 655, size: 11, font });
  form.createTextField("business_name").addToPage(first, { x: 160, y: 650, width: 250, height: 20, font });

  first.drawText("Street address", { x: 50, y: 605, size: 11, font });
  const address = form.createTextField("street_address");
  address.addToPage(first, { x: 160, y: 600, width: 250, height: 20, font });
  address.setMaxLength(40);

  form.createCheckBox("is_llc").addToPage(first, { x: 50, y: 550, width: 14, height: 14 });
  first.drawText("Limited liability company", { x: 70, y: 552, size: 11, font });

  first.drawText("Filing state", { x: 50, y: 505, size: 11, font });
  const state = form.createDropdown("filing_state");
  state.addOptions(["Ohio", "Michigan"]);
  state.addToPage(first, { x: 160, y: 500, width: 120, height: 20, font });

  first.drawText("Signature of organizer", { x: 50, y: 455, size: 11, font });
  form.createTextField("organizer_signature").addToPage(first, { x: 200, y: 450, width: 200, height: 20, font });

  // pdf-lib can't create signature fields, so this one is built by hand
  first.drawText("Applicant signature", { x: 50, y: 405, size: 11, font });
  const signature = doc.context.register(
    doc.context.obj({
      FT: "Sig",
      T: PDFString.of("applicant_signature"),
      Type: "Annot",
      Subtype: "Widget",
      Rect: [200, 400, 400, 420],
      P: first.ref,
    }),
  );
  form.acroForm.addField(signature);
  first.node.addAnnot(signature);

  second.drawText("Contact email", { x: 50, y: 705, size: 11, font });
  form.createTextField("contact_email").addToPage(second, { x: 160, y: 700, width: 250, height: 20, font });

  return new Uint8Array(await doc.save());
}

// Shaped like IRS Form SS-4: its title and revision line, and blanks with the real form's field names
export async function ss4LikeForm(revision = "Rev. December 2025"): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  const page = doc.addPage([612, 792]);
  page.drawText(`Form SS-4 (${revision})`, { x: 40, y: 760, size: 10, font });
  page.drawText("Application for Employer Identification Number", { x: 150, y: 760, size: 12, font });
  const lines: [string, string][] = [
    ["f1_2[0]", "1 Legal name of entity (or individual) for whom the EIN is being requested"],
    ["f1_3[0]", "2 Trade name of business (if different from name on line 1)"],
    ["Line4ReadOrder[0].f1_5[0]", "4a Mailing address (room, apt., suite no. and street, or P.O. box)"],
    ["Line4ReadOrder[0].f1_6[0]", "4b City, state, and ZIP code (if foreign, see instructions)"],
    ["f1_7[0]", "5a Street address (if different) (Don't enter a P.O. box.)"],
    ["f1_8[0]", "5b City, state, and ZIP code (if foreign, see instructions)"],
    ["f1_9[0]", "6 County and state where principal business is located"],
    ["f1_10[0]", "7a Name of responsible party"],
    ["f1_11[0]", "7b SSN, ITIN, or EIN"],
    ["f1_12[0]", "8b If 8a is Yes, enter the number of LLC members"],
    ["f1_31[0]", "11 Date business started or acquired (month, day, year)"],
    ["f1_38[0]", "17 Indicate principal line of merchandise sold"],
  ];
  lines.forEach(([name, label], index) => {
    const y = 720 - index * 40;
    page.drawText(label, { x: 40, y: y + 14, size: 8, font });
    form.createTextField(`topmostSubform[0].Page1[0].${name}`).addToPage(page, { x: 40, y, width: 400, height: 12, font });
  });
  for (const [name, label, y] of [
    ["c1_1[0]", "8a LLC Yes", 230],
    ["c1_1[1]", "8a LLC No", 215],
    ["c1_3[0]", "Sole proprietor (SSN)", 200],
    ["c1_3[2]", "Partnership", 185],
  ] as const) {
    form.createCheckBox(`topmostSubform[0].Page1[0].${name}`).addToPage(page, { x: 450, y, width: 10, height: 10 });
    page.drawText(label, { x: 465, y, size: 8, font });
  }
  return new Uint8Array(await doc.save());
}
