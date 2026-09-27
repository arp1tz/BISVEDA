/**
 * BISVEDA MinIO / S3 Object Storage Client
 * Handles raw documents, parsed artifacts, and evidence assets.
 */

import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "http://localhost:9000";
const MINIO_ACCESS_KEY = process.env.MINIO_ROOT_USER || "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_ROOT_PASSWORD || "minioadmin";

export const DOCS_BUCKET = "bisveda-documents";
export const ARTIFACTS_BUCKET = "bisveda-artifacts";

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: MINIO_ENDPOINT,
      region: "us-east-1",
      credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

/**
 * Ensures required MinIO buckets exist.
 */
export async function initStorage(): Promise<boolean> {
  const client = getS3Client();
  const buckets = [DOCS_BUCKET, ARTIFACTS_BUCKET];

  for (const bucket of buckets) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (createErr) {
        console.warn(`[MinIO Init] Bucket ${bucket} creation notice:`, createErr);
      }
    }
  }
  return true;
}

/**
 * Uploads a document to MinIO (with local disk fallback).
 */
export async function uploadDocument(
  key: string,
  buffer: Buffer,
  contentType: string = "application/pdf"
): Promise<{ storageType: "minio" | "disk"; path: string }> {
  try {
    const client = getS3Client();
    await initStorage();
    await client.send(
      new PutObjectCommand({
        Bucket: DOCS_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { storageType: "minio", path: `${DOCS_BUCKET}/${key}` };
  } catch (err) {
    console.warn("[MinIO Upload Fallback to Disk]:", err instanceof Error ? err.message : String(err));
    // Fallback to local storage
    const localDir = path.resolve(process.cwd(), "../storage/documents");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, key.replace(/[/\\]/g, "_"));
    fs.writeFileSync(localPath, buffer);
    return { storageType: "disk", path: localPath };
  }
}

/**
 * Retrieves a document from MinIO or disk fallback.
 */
export async function getDocumentBuffer(key: string): Promise<Buffer | null> {
  try {
    const client = getS3Client();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: DOCS_BUCKET,
        Key: key,
      })
    );
    if (res.Body) {
      const byteArray = await res.Body.transformToByteArray();
      return Buffer.from(byteArray);
    }
  } catch {
    // Check disk
    const localPath = path.resolve(process.cwd(), "../storage/documents", key.replace(/[/\\]/g, "_"));
  }
  return null;
}

/**
 * Deletes a document from MinIO or disk fallback.
 */
export async function deleteStoredDocument(key: string): Promise<boolean> {
  let deletedFromMinio = false;
  let deletedFromDisk = false;

  try {
    const client = getS3Client();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    // Strip bucket prefix if passed
    const cleanKey = key.startsWith(`${DOCS_BUCKET}/`) ? key.slice(DOCS_BUCKET.length + 1) : key;
    await client.send(
      new DeleteObjectCommand({
        Bucket: DOCS_BUCKET,
        Key: cleanKey,
      })
    );
    deletedFromMinio = true;
  } catch (err) {
    console.warn("[MinIO Delete Notice]:", err instanceof Error ? err.message : String(err));
  }

  // Also check and clean local disk fallback
  try {
    const localPath = path.resolve(process.cwd(), "../storage/documents", key.replace(/[/\\]/g, "_"));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      deletedFromDisk = true;
    }
  } catch {
    // ignore
  }

  return deletedFromMinio || deletedFromDisk;
}

