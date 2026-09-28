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

/**
 * Merges form updates into state, finds missing required fields, and provides the next prompts.
 */
export function stepFormI(
  currentState: Record<string, unknown> = {},
  updates: Record<string, unknown> = {}
): StepFormIResult {
  const schema = getFormISchema();
  const formState: Record<string, string> = {};
  const newlyAddedLabels: Array<{ label: string; value: string }> = [];

  // Preserve existing string state
  for (const [k, v] of Object.entries(currentState)) {
    if (typeof v === "string" && v.trim().length > 0) {
      formState[k] = v.trim();
    }
  }

  // Merge updates
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === "string" && v.trim().length > 0) {
      // Find field key by key or label or field number
      const fieldDef = schema.find(
        (f) =>
          f.key === k ||
          f.label.toLowerCase() === k.toLowerCase() ||
          `field_${f.field}` === k ||
          `field${f.field}` === k
      );
      const targetKey = fieldDef ? fieldDef.key : k;
      const label = fieldDef ? fieldDef.label : k;
      formState[targetKey] = v.trim();
      newlyAddedLabels.push({ label, value: v.trim() });
    }
  }

  const missingRequired: string[] = [];
  const missingDefs: FormFieldDef[] = [];

  for (const f of schema) {
    const val = formState[f.key] || formState[`field_${f.field}`] || formState[f.label];
    if (f.required && (!val || val.trim().length === 0)) {
      missingRequired.push(f.label);
      missingDefs.push(f);
    }
  }

  const isComplete = missingRequired.length === 0;
  const nextPrompts = missingDefs.slice(0, 2).map((f) => `• **${f.label}**: ${f.prompt}`);

  let replyText = "";
  if (isComplete) {
    replyText =
      "🎉 **All required Form I fields are complete!**\n\nYour application draft has been prepared according to the official Bureau of Indian Standards format. You can open the printable draft below to review and print your draft, then proceed to submit your application on the official **Manak Online** portal.";
  } else {
    const filledCount = schema.length - missingDefs.length;
    let ackBlock = "";
    if (newlyAddedLabels.length > 0) {
      ackBlock =
        "✅ **Recorded Details:**\n" +
        newlyAddedLabels.map((item) => `• **${item.label}**: ${item.value}`).join("\n") +
        "\n\n";
    }

    replyText =
      ackBlock +
      `📋 **Form I Jeweller Registration Draft** (${filledCount}/${schema.length} fields filled)\n\n` +
      `To continue your registration draft, please provide the following details:\n\n` +
      nextPrompts.join("\n\n");
  }

  const card: FormICard = {
    fields: formState,
    missing_required: missingRequired,
    print_url: isComplete || Object.keys(formState).length >= 3 ? "/form-i/print" : undefined,
  };

  return {
    formState,
    missingRequired,
    nextQuestions: nextPrompts,
    isComplete,
    card,
    text: replyText,
  };
}
