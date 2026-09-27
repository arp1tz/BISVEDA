/**
 * POST /api/v8/feedback
 * §23.2 | Spec ref: v8 architecture bis veda.txt
 *
 * Typed Feedback Endpoint:
 * Collects user evaluation on dossier turns, standard recommendations,
 * and translation accuracy.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type FeedbackReason =
  | "wrong_standard"
  | "wrong_applicability"
  | "missing_evidence"
  | "poor_explanation"
  | "outdated_information"
  | "translation_issue"
  | "other";

export interface FeedbackSubmission {
  id?: string;
  query?: string;
  dossierId?: string;
  turnIndex?: number;
  vote: "up" | "down";
  reason?: FeedbackReason;
  comment?: string;
  userRole?: string;
  createdAt?: string;
}

const FEEDBACK_LOG_DIR = path.join(process.cwd(), "data", "feedback");
const FEEDBACK_FILE = path.join(FEEDBACK_LOG_DIR, "feedback_submissions.jsonl");

export async function POST(req: NextRequest) {
  try {
    const body: FeedbackSubmission = await req.json();

    if (!body.vote || !["up", "down"].includes(body.vote)) {
      return NextResponse.json(
        { error: "Invalid vote: must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    const entry: FeedbackSubmission = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      query: body.query || "",
      dossierId: body.dossierId,
      turnIndex: body.turnIndex,
      vote: body.vote,
      reason: body.reason,
      comment: body.comment ? body.comment.slice(0, 500) : undefined,
      userRole: body.userRole || "anonymous",
      createdAt: new Date().toISOString(),
    };

    // Ensure directory exists and append record
    if (!fs.existsSync(FEEDBACK_LOG_DIR)) {
      fs.mkdirSync(FEEDBACK_LOG_DIR, { recursive: true });
    }

    fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(entry) + "\n", "utf-8");

    return NextResponse.json({
      success: true,
      feedbackId: entry.id,
      message: "Feedback recorded successfully. Thank you for helping improve BISVEDA.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to record feedback", details: error.message },
      { status: 500 }
    );
  }
}
