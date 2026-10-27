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
