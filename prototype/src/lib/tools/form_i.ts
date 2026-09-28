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
 * Merges form updates into state, finds missing required fields, and provides the next prompts.
 */
export function stepFormI(
  currentState: Record<string, unknown> = {},
  updates: Record<string, unknown> = {}
): StepFormIResult {
  const schema = getFormISchema();
  const formState: Record<string, string> = {};

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
      formState[targetKey] = v.trim();
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
    replyText =
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
