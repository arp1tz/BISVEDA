/**
 * BISVEDA — Attachment helpers (lib/attachments.ts, P11.2)
 *
 * Turns a user-picked File into the { name, previewUrl, base64, type } shape the chat API expects.
 * Images are downscaled (longest side 1600px, JPEG) before they are stored: phone photos are
 * often 5-10MB, which overflows the sessionStorage hand-off from the landing page to the chat
 * page and needlessly inflates the vision request.
 */

export interface AttachmentItem {
  name: string;
  previewUrl?: string;
  base64?: string;
  type?: string;
}

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.85;
const MAX_DOC_BYTES = 6 * 1024 * 1024;

export const ATTACH_ACCEPT_PHOTOS = "image/*";
export const ATTACH_ACCEPT_FILES = "image/*,.pdf,.doc,.docx";

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image."));
    img.src = url;
  });
}

function splitDataUrl(dataUrl: string): string {
  return dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
}

async function downscaleImage(file: File): Promise<AttachmentItem> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return { name: `${baseName}.jpg`, previewUrl: dataUrl, base64: splitDataUrl(dataUrl), type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Converts a File to an AttachmentItem. Throws an Error with a user-readable message on failure. */
export async function fileToAttachment(file: File): Promise<AttachmentItem> {
  if (file.type.startsWith("image/")) {
    try {
      return await downscaleImage(file);
    } catch {
      // Undecodable in this browser (e.g. HEIC): fall back to the raw file if it is small enough.
      if (file.size > MAX_DOC_BYTES) throw new Error("This image is too large. Please choose a smaller photo.");
      const dataUrl = await readAsDataUrl(file);
      return { name: file.name, previewUrl: dataUrl, base64: splitDataUrl(dataUrl), type: file.type };
    }
  }

  if (file.size > MAX_DOC_BYTES) throw new Error("This file is larger than 6 MB. Please choose a smaller file.");
  const dataUrl = await readAsDataUrl(file);
  return { name: file.name, base64: splitDataUrl(dataUrl), type: file.type || "application/octet-stream" };
}

/** True on phones/tablets, where the camera <input capture> opens the native camera app. */
export function hasCoarsePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}
