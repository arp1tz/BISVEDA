/**
 * BISVEDA — PDF upload checks and original-file storage (R2.1).
 *
 * Originals are stored content-addressed: storage/originals/{sha256}.pdf.
 * storage/ is gitignored and lives on the project drive (never C:).
 */

import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const STORAGE_ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");

export type UploadCheck =
  | { ok: true; sha256: string; bytes: number }
  | { ok: false; status: number; error: string };

/** Validates size and PDF magic bytes, then returns the SHA-256 of the content. */
export function checkPdfBuffer(buf: Buffer): UploadCheck {
  if (buf.length === 0) return { ok: false, status: 400, error: "The file is empty." };
  if (buf.length > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: `The file is larger than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` };
  }
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, status: 400, error: "Not a PDF: the file does not start with the %PDF- signature." };
  }
  // A complete PDF ends with %%EOF near the end of the file. Missing it usually means a truncated upload.
  const tail = buf.subarray(Math.max(0, buf.length - 1024)).toString("latin1");
  if (!tail.includes("%%EOF")) {
    return { ok: false, status: 400, error: "The PDF looks truncated: no %%EOF marker at the end of the file." };
  }
  return { ok: true, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
}

/** Writes the original once, keyed by hash. An existing file with the same hash is left as it is. */
export async function storeOriginal(sha256: string, buf: Buffer): Promise<string> {
  const dir = path.join(STORAGE_ROOT, "originals");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${sha256}.pdf`);
  try {
    await writeFile(file, buf, { flag: "wx" });
  } catch (err: any) {
    if (err?.code !== "EEXIST") throw err;
  }
  return path.relative(STORAGE_ROOT, file).split(path.sep).join("/");
}
