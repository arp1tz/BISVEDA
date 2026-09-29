/**
 * BISVEDA — Form I editable Word draft (src/lib/tools/form_i_docx.ts, P13.2)
 *
 * Builds a .docx that follows the layout and wording of the official Form I PDF
 * (example docs uploaded by employees/Form I ...pdf, KB doc "form-i"): items 1 to 13,
 * the corporate-outlet and payment tables, and the signature block. Values the user gave
 * in chat are filled in; everything else is left blank for the applicant to complete in Word.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const FONT = "Calibri";
const BLANK = "";

function text(value: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}): TextRun {
  return new TextRun({ text: value, font: FONT, size: opts.size ?? 22, bold: opts.bold, italics: opts.italics, color: opts.color });
}

function para(runs: TextRun[] | string, opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number } = {}): Paragraph {
  return new Paragraph({
    children: typeof runs === "string" ? [text(runs)] : runs,
    alignment: opts.align,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
  });
}

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
};

function cell(value: string, widthPct: number, bold = false): TableCell {
  const lines = (value || BLANK).split(/\n/);
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: lines.map((l) => new Paragraph({ children: [text(l, { bold })] })),
  });
}

/** One numbered item of the form: number | official label | the applicant's entry (editable). */
function itemRow(no: string, label: string, value: string | undefined): TableRow {
  return new TableRow({
    children: [cell(no, 8, true), cell(label, 42, true), cell(value?.trim() || BLANK, 50)],
  });
}

function blankTable(headers: string[], rows = 2): Table {
  const w = Math.floor(100 / headers.length);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h) => cell(h, w, true)) }),
      ...Array.from({ length: rows }, () => new TableRow({ children: headers.map(() => cell(BLANK, w)) })),
    ],
  });
}

export async function buildFormIDocx(fields: Record<string, string>): Promise<Buffer> {
  const f = (k: string) => fields[k];
  const today = new Date().toLocaleDateString("en-IN");

  const items = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      itemRow("1.", "Name of Jeweller (firm/company)", f("name_of_jeweller")),
      itemRow("2. (a)", "Address of Outlet with Pin Code, District and State; Tel (with STD code); Fax (with STD code); E-mail", f("outlet_address")),
      itemRow("2. (b)", "Location along with Landmark", f("near_landmark")),
      itemRow("3.", "Type of Ownership: Proprietorship / Partnership / Private Limited Company / PSU", f("constitution")),
      itemRow("4.", "Details of Management (name of all Partners/Directors, with designation: Proprietor/Partner/Director/CEO)", f("management_names")),
      itemRow("5.", "Details of Contact Person: Name, Designation, Mobile, e-mail", f("contact_person")),
      itemRow("6.", "Certificate applied for: Gold Jewellery/artefacts as per IS 1417 and/or Silver Jewellery/artefacts as per IS 2112", f("certificate_applied_for")),
      itemRow("7.", "(a) Any other BIS Certificate held: Yes / No\n(b) If yes: Certificate No., IS No., Validity, Product", f("existing_certificates")),
      itemRow("8.", "Annual Turnover in Crores (attach proof)", f("annual_turnover")),
      itemRow("9.", "If application is for Certificate at Corporate level: Yes / No (if Yes, give outlet details in the table below)", f("corporate_details")),
      itemRow("10.", "Details of Previous Cancellation/Convictions, if any", f("cancellation_conviction")),
      itemRow("11.", "Details of Payment: Demand draft / Net Banking / Bank Challan (see the table below)", f("payment_details")),
      itemRow(
        "12.",
        "I/We shall use the following identification mark or logo on jewellery/artefact for the purpose of Hallmarking",
        f("identification_mark")
      ),
    ],
  });

  const doc = new Document({
    creator: "BISVEDA",
    title: "Form I draft: Application for Grant of Certificate of Registration to Jewellers",
    description: "Editable draft prepared with BISVEDA. Submit the final application on Manak Online.",
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [
          para([text("DRAFT prepared with BISVEDA. Review, complete and submit on Manak Online (www.manakonline.in).", { bold: true, size: 18, color: "BD2F2F" })], {
            align: AlignmentType.CENTER,
          }),
          para([text("Form I", { bold: true, size: 28 })], { align: AlignmentType.CENTER, after: 40, before: 120 }),
          para([text("(refer sub-regulation (2) of regulation 3)", { italics: true, size: 20 })], { align: AlignmentType.CENTER, after: 40 }),
          para([text("Bureau of Indian Standards", { bold: true, size: 26 })], { align: AlignmentType.CENTER, after: 40 }),
          para([text("Application for Grant of Certificate of Registration to Jewellers For Sale of Hallmarked Articles", { bold: true })], {
            align: AlignmentType.CENTER,
            after: 40,
          }),
          para([text("(Strike off whichever is not applicable)", { italics: true, size: 20 })], { align: AlignmentType.CENTER, after: 240 }),

          items,

          para([text("Item 9: outlets to be covered (enclose separate sheet, as required)", { bold: true, size: 20 })], { before: 240 }),
          blankTable([
            "S.No",
            "Location of Outlet (State and City/Town)",
            "Address of outlet",
            "Contact Person at outlet (Name & Designation)",
            "Contact details at outlet (Phone No., Email Id etc.)",
          ]),

          para([text("Item 11: payment (please refer to the fees applicable for jewellers)", { bold: true, size: 20 })], { before: 240 }),
          blankTable(["Amount (in Rs.)", "Name of Bank", "Demand draft No. / UTR No. / Bank Challan No.", "Date"], 1),

          para(
            [
              text("12. ", { bold: true }),
              text(
                "This identification mark shall be provided to the Assaying & Hallmarking Centre when jewellery/artefact is offered for Hallmarking. I/We, shall on our own, not apply the identification mark, in any manner, on the hallmarked jewellery/artefact."
              ),
            ],
            { before: 240 }
          ),
          para([
            text("13. ", { bold: true }),
            text(
              "I/We undertake that we shall strictly follow the provisions of Bureau of Indian Standards Act, 2016, Rules, 2017, and Hallmarking Regulations 2018 and guidelines for conformity assessment scheme issued thereunder upon grant of Certificate by Bureau of Indian Standards for sale of gold or silver hallmarked articles as per IS 1417/2112."
            ),
          ]),

          para([text("Signature: ______________________   (Proprietor/Partner/Director)")], { before: 480 }),
          para("Name: ______________________"),
          para("Designation: ______________________"),
          para(`Date: ${today}`),
          para("Place: ______________________"),
          para("Seal"),

          para(
            [
              text(
                "This draft was prepared from details you typed in chat. It is not an application and has not been sent to BIS. Check every entry, attach the turnover proof and fee details, and apply on Manak Online.",
                { italics: true, size: 18, color: "64748B" }
              ),
            ],
            { before: 360 }
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
