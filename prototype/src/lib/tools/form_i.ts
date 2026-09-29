/**
 * BISVEDA — Form I Conversational Drafting Tool (src/lib/tools/form_i.ts, P5.4)
 *
 * Drives the interactive drafting of Form I (Application for Grant of Certificate
 * of Registration to Jewellers for Sale of Hallmarked Articles) based on
 * the official 13-field schema in data/kb/form_i_schema.json.
 */

import fs from "fs";
import path from "path";
import type { FormICard } from "../pipeline/respond";

export interface FormFieldDef {
  field: number;
  key: string;
  label: string;
  required: boolean;
  type: string;
  options?: string[];
  prompt: string;
}

let cachedSchema: FormFieldDef[] | null = null;

export function getFormISchema(): FormFieldDef[] {
  if (cachedSchema) return cachedSchema;

  const candidatePaths = [
    path.resolve(process.cwd(), "data/kb/form_i_schema.json"),
    path.resolve(process.cwd(), "prototype/data/kb/form_i_schema.json"),
    path.resolve(__dirname, "../../../data/kb/form_i_schema.json"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        cachedSchema = JSON.parse(fs.readFileSync(p, "utf-8")) as FormFieldDef[];
        return cachedSchema;
      } catch {}
    }
  }

  return [];
}

export interface StepFormIResult {
  formState: Record<string, string>;
  missingRequired: string[];
  nextQuestions: string[];
  isComplete: boolean;
  card: FormICard;
  text: string;
}

/**
 * Parses user message for Form I field key-values deterministically.
 */
export function parseFormInputsFromText(
  text: string,
  currentPendingFieldKey?: string
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text || typeof text !== "string") return result;

  // Split lines or delimiters (newlines, semicolons)
  const lines = text.split(/[\r\n]+|[;]+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // 1. Name patterns: "name utkarsh kale", "name: utkarsh kale", "jeweller name utkarsh kale", "my name is utkarsh kale"
    const nameMatch = line.match(/^(?:jeweller\s+name|firm\s+name|applicant\s+name|my\s+name\s+is|name)\s*[:=-]?\s+(.+)$/i);
    if (nameMatch && nameMatch[1].trim()) {
      result["name_of_jeweller"] = nameMatch[1].trim();
      continue;
    }

    // 2. Address patterns: "adress wardha 442001", "address: wardha 442001", "outlet address ...", "outlet: ..."
    const addrMatch = line.match(/^(?:outlet\s+address|shop\s+address|address|adress|addr|location)\s*[:=-]?\s+(.+)$/i);
    if (addrMatch && addrMatch[1].trim()) {
      result["outlet_address"] = addrMatch[1].trim();
      continue;
    }

    // 3. Landmark patterns: "landmark: near station", "near landmark: ..."
    const landmarkMatch = line.match(/^(?:near\s+landmark|landmark|near)\s*[:=-]?\s+(.+)$/i);
    if (landmarkMatch && landmarkMatch[1].trim()) {
      result["near_landmark"] = landmarkMatch[1].trim();
      continue;
    }

    // 4. Constitution / firm type
    const constMatch = line.match(/^(?:constitution|firm\s+type|type\s+of\s+firm|company\s+type)\s*[:=-]?\s+(.+)$/i);
    if (constMatch && constMatch[1].trim()) {
      const val = constMatch[1].trim().toLowerCase();
      if (val.includes("proprietor")) result["constitution"] = "Proprietorship";
      else if (val.includes("partner")) result["constitution"] = "Partnership";
      else if (val.includes("private") || val.includes("pvt")) result["constitution"] = "Private Limited Company";
      else if (val.includes("psu") || val.includes("public")) result["constitution"] = "PSU";
      else result["constitution"] = constMatch[1].trim();
      continue;
    }

    // Bare constitution words
    if (/^\s*(?:proprietorship|proprietor)\s*$/i.test(line)) {
      result["constitution"] = "Proprietorship";
      continue;
    } else if (/^\s*(?:partnership|partner)\s*$/i.test(line)) {
      result["constitution"] = "Partnership";
      continue;
    } else if (/^\s*(?:private\s+limited|pvt\s+ltd|pvt\.\s*ltd)\s*$/i.test(line)) {
      result["constitution"] = "Private Limited Company";
      continue;
    }

    // 5. Contact person
    const contactMatch = line.match(/^(?:contact\s+person|contact|signatory|authorized\s+person)\s*[:=-]?\s+(.+)$/i);
    if (contactMatch && contactMatch[1].trim()) {
      result["contact_person"] = contactMatch[1].trim();
      continue;
    }

    // 6. Management names
    const mgmtMatch = line.match(/^(?:management\s+names?|directors?|partners?|owners?)\s*[:=-]?\s+(.+)$/i);
    if (mgmtMatch && mgmtMatch[1].trim()) {
      result["management_names"] = mgmtMatch[1].trim();
      continue;
    }

    // 7. Turnover
    const turnoverMatch = line.match(/^(?:annual\s+)?turnover\s*[:=-]?\s+(.+)$/i);
    if (turnoverMatch && turnoverMatch[1].trim()) {
      result["annual_turnover"] = turnoverMatch[1].trim();
      continue;
    }
  }

  // Fallback: If user entered a single answer and we have a specific pending field
  if (
    Object.keys(result).length === 0 &&
    currentPendingFieldKey &&
    text.trim().length > 0 &&
    text.trim().length < 100 &&
    !text.includes("?")
  ) {
    result[currentPendingFieldKey] = text.trim();
  }

  return result;
}

/** Short labels for chat replies (the schema labels are the long official wording). */
const SHORT_LABEL: Record<string, string> = {
  name_of_jeweller: "Firm name",
  outlet_address: "Outlet address with PIN code, phone and email",
  near_landmark: "Nearby landmark",
  constitution: "Type of ownership (Proprietorship / Partnership / Private Limited Company / PSU)",
  management_names: "Proprietor, partner or director names",
  contact_person: "Contact person: name, designation and mobile",
  certificate_applied_for: "Certificate for gold (IS 1417), silver (IS 2112) or both",
  existing_certificates: "Any other BIS certificate held",
  annual_turnover: "Annual turnover (in crores)",
  corporate_details: "Corporate-level application with more outlets",
  cancellation_conviction: "Any previous cancellation or conviction (or \"none\")",
  payment_details: "Fee payment details",
  identification_mark: "Your identification mark or logo for hallmarked jewellery",
};

const FINISH_RE =
  /\b(?:that'?s\s*all|thats\s*it|done|finish|generate|download|give\s*(?:me\s*)?(?:the\s*)?(?:draft|form|file|doc)|create\s*(?:the\s*)?(?:draft|doc)|bas\s*itna|ho\s*gaya|bana\s*do|de\s*do|file\s*do)\b/i;

/** The user asked to stop answering and get the draft now (missing fields stay blank in the Word file). */
export function wantsFormIFinish(text: string): boolean {
  return FINISH_RE.test(text || "");
}

/** Normalizes select-type answers and returns problems worth a follow-up question. */
function normalizeAndValidate(state: Record<string, string>): string[] {
  const issues: string[] = [];

  const c = state.constitution?.toLowerCase();
  if (c) {
    if (/propriet|proprietary|ekal|single\s*owner|akela/.test(c)) state.constitution = "Proprietorship";
    else if (/partner|bhagidari/.test(c)) state.constitution = "Partnership";
    else if (/pvt|private|ltd|limited/.test(c)) state.constitution = "Private Limited Company";
    else if (/psu|public\s*sector|government/.test(c)) state.constitution = "PSU";
    else {
      issues.push(`Ownership type "${state.constitution}" is not one of Proprietorship, Partnership, Private Limited Company or PSU. Which one is it?`);
      delete state.constitution;
    }
  }

  const cert = state.certificate_applied_for?.toLowerCase();
  if (cert) {
    const gold = /gold|sona|sone|1417/.test(cert);
    const silver = /silver|chandi|chaandi|2112/.test(cert);
    if (/both|dono/.test(cert) || (gold && silver)) state.certificate_applied_for = "Gold (IS 1417) and Silver (IS 2112) jewellery/artefacts";
    else if (gold) state.certificate_applied_for = "Gold jewellery/artefacts as per IS 1417";
    else if (silver) state.certificate_applied_for = "Silver jewellery/artefacts as per IS 2112";
  }

  const cc = state.cancellation_conviction?.trim().toLowerCase();
  if (cc && /^(?:no|none|nil|nahi|nahin|na|koi\s*nahi|no\s*cancellation.*|never)\.?$/.test(cc)) state.cancellation_conviction = "None";

  if (state.outlet_address && !/\b\d{6}\b/.test(state.outlet_address.replace(/\s(?=\d{3}\b)/g, ""))) {
    issues.push("Your outlet address has no 6-digit PIN code. What is the PIN code?");
  }
  if (state.annual_turnover && !/\d/.test(state.annual_turnover)) {
    issues.push("What is the approximate annual turnover as a number (in crores)?");
  }
  return issues;
}

export interface StepFormIOptions {
  /** User asked to generate the draft now; unanswered fields stay blank. */
  finishNow?: boolean;
}

/**
 * Merges form updates into state, validates them, and writes the next turn: one grouped list of
 * everything still missing (not one question per turn), or the finished draft.
 */
export function stepFormI(
  currentState: Record<string, unknown> = {},
  updates: Record<string, unknown> = {},
  opts: StepFormIOptions = {}
): StepFormIResult {
  const schema = getFormISchema();
  const formState: Record<string, string> = {};
  const newlyAdded: string[] = [];

  for (const [k, v] of Object.entries(currentState)) {
    if (typeof v === "string" && v.trim().length > 0) formState[k] = v.trim();
  }

  for (const [k, v] of Object.entries(updates)) {
    if (typeof v !== "string" || v.trim().length === 0) continue;
    const fieldDef = schema.find(
      (f) => f.key === k || f.label.toLowerCase() === k.toLowerCase() || `field_${f.field}` === k || `field${f.field}` === k
    );
    if (!fieldDef) continue; // never store keys the form doesn't have
    if (formState[fieldDef.key] === v.trim()) continue; // unchanged, don't repeat it back
    formState[fieldDef.key] = v.trim();
    if (!newlyAdded.includes(fieldDef.key)) newlyAdded.push(fieldDef.key);
  }

  const issues = normalizeAndValidate(formState);

  const missingDefs = schema.filter((f) => f.required && !formState[f.key]?.trim());
  const missingRequired = missingDefs.map((f) => f.label);
  const isComplete = missingDefs.length === 0 && issues.length === 0;
  const ready = isComplete || Boolean(opts.finishNow && Object.keys(formState).length > 0);
  const filledCount = schema.filter((f) => formState[f.key]?.trim()).length;

  const recorded =
    newlyAdded.length > 0
      ? "**Noted:**\n" + newlyAdded.filter((k) => formState[k]).map((k) => `- ${SHORT_LABEL[k] || k}: ${formState[k]}`).join("\n") + "\n\n"
      : "";

  let replyText: string;
  let nextQuestions: string[] = [];
  if (ready) {
    const blanks = missingDefs.length > 0 ? ` ${missingDefs.length} required item(s) are still blank, fill them in the Word file.` : "";
    replyText =
      recorded +
      `**Your Form I draft is ready** (${filledCount} of ${schema.length} items filled).${blanks}\n\n` +
      "Download the Word draft below, edit anything you like, attach turnover proof and fee details, then apply on **Manak Online**. This draft is not submitted to BIS.";
  } else if (filledCount === 0 && newlyAdded.length === 0) {
    nextQuestions = missingDefs.map((f) => SHORT_LABEL[f.key] || f.label);
    replyText =
      "I will draft **Form I** (registration of a jeweller for sale of hallmarked articles) with you and give you an editable Word file.\n\n" +
      "Send these details, all in one message is fine, in English or Hindi:\n\n" +
      nextQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") +
      "\n\nOptional: nearby landmark, other BIS certificates, more outlets, fee payment details.";
  } else {
    nextQuestions = [...issues, ...missingDefs.map((f) => SHORT_LABEL[f.key] || f.label)];
    replyText =
      recorded +
      `**${filledCount} of ${schema.length} items filled.** I still need:\n\n` +
      nextQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n") +
      '\n\nSay **"that\'s all"** anytime to get the draft with these left blank.';
  }

  const card: FormICard = {
    fields: formState,
    missing_required: missingRequired,
    ready,
    print_url: ready ? "/form-i/print" : undefined,
  };

  return { formState, missingRequired, nextQuestions, isComplete: ready, card, text: replyText };
}

const EXTRACT_PROMPT = `You fill a BIS Form I (jeweller hallmarking registration) from what the user typed. The user may write English, Hindi, Hinglish or another Indian language, in any order, in one message or several.

Return strict JSON: {"fields": {<key>: <value>}} using ONLY these keys, and only for details the user actually stated in the CURRENT message:
- name_of_jeweller: firm or shop name
- outlet_address: full outlet address; include PIN, district, state, phone, email if given
- near_landmark: nearby landmark
- constitution: Proprietorship | Partnership | Private Limited Company | PSU
- management_names: owner/partner/director names with designation if given
- contact_person: contact person's name, designation, mobile, email
- certificate_applied_for: gold | silver | both
- existing_certificates: other BIS certificates held (or "No")
- annual_turnover: turnover as stated, e.g. "2.5 crore"
- corporate_details: other outlets / corporate-level details
- cancellation_conviction: previous cancellation or conviction details, or "None" if the user says there was none
- payment_details: fee payment details
- identification_mark: the jeweller's identification mark or logo

Rules: copy names, numbers, PIN codes, phone numbers and emails exactly. Write values in English (translate words like "sona" to gold, "koi nahi" to None) but keep proper names as typed. Never invent a value. If the message is a question or has no form details, return {"fields": {}}.`;

/** LLM extraction of Form I details from free text (any language); the regex parser is the fallback. */
export async function extractFormFields(message: string, formState?: Record<string, unknown>): Promise<Record<string, string>> {
  const found = await extractFormFieldsInner(message, formState);
  // Answer to "what is the PIN code?": a lone 6-digit number joins the saved address (the model may skip it).
  const address = typeof formState?.outlet_address === "string" ? formState.outlet_address : "";
  const pin = message.match(/(?<!\d)(\d{3}\s?\d{3})(?!\d)/)?.[1]?.replace(/\s/, "");
  if (address && !found.outlet_address && pin && !/\b\d{6}\b/.test(address)) {
    found.outlet_address = `${address}, PIN ${pin}`;
  }
  return found;
}

async function extractFormFieldsInner(message: string, formState?: Record<string, unknown>): Promise<Record<string, string>> {
  const deterministic = parseFormInputsFromText(message);
  if (!process.env.GROQ_API_KEY) return deterministic;
  try {
    const { groqChatJson } = await import("../llm");
    const parsed = await groqChatJson<{ fields?: Record<string, unknown> }>(
      [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: JSON.stringify({ message, already_filled: formState || {} }) },
      ],
      { model: "fast", temperature: 0, maxTokens: 700 }
    );
    const allowed = new Set(getFormISchema().map((f) => f.key));
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed?.fields || {})) {
      if (allowed.has(k) && typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return { ...deterministic, ...out };
  } catch (err) {
    console.warn("[form_i] LLM extraction failed, using regex parser:", err instanceof Error ? err.message : err);
    return deterministic;
  }
}
