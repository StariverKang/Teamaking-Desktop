import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type StoreUploadInput = {
  buffer: Buffer;
  userId: string;
  safeName: string;
  contentType: string;
};

type StoredUpload = {
  fileUrl: string;
  storageKey: string;
  storageMode: string;
  storageProvider: string;
  objectKey: string;
};

function r2Endpoint() {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return "";
}

function hasR2Config() {
  return Boolean(
    r2Endpoint() &&
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

function storageMode() {
  const configured = (process.env.UPLOAD_STORAGE_MODE ?? "").trim().toLowerCase();
  if (configured) return configured;
  if (hasR2Config()) return "r2";
  return "local";
}

async function storeR2Upload(input: StoreUploadInput): Promise<StoredUpload> {
  const endpoint = r2Endpoint();
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured.");
  }

  const objectKey = `uploads/${input.userId}/${input.safeName}`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: input.buffer,
    ContentType: input.contentType
  }));

  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return {
    fileUrl: publicBase ? `${publicBase}/${objectKey}` : `r2://${bucket}/${objectKey}`,
    storageKey: objectKey,
    objectKey,
    storageMode: "r2",
    storageProvider: "cloudflare_r2"
  };
}

async function storeLocalUpload(input: StoreUploadInput): Promise<StoredUpload> {
  const relativeDir = `/uploads/${input.userId}`;
  const objectKey = `${relativeDir}/${input.safeName}`;
  const targetDir = path.join(process.cwd(), "public", relativeDir);
  const targetPath = path.join(process.cwd(), "public", objectKey);
  await mkdir(targetDir, { recursive: true });
  await writeFile(targetPath, input.buffer);
  return {
    fileUrl: objectKey,
    storageKey: objectKey,
    objectKey,
    storageMode: "local",
    storageProvider: "local_public_uploads"
  };
}

function storeInlineUpload(input: StoreUploadInput): StoredUpload {
  return {
    fileUrl: `data:${input.contentType};base64,${input.buffer.toString("base64")}`,
    storageKey: `inline/${input.userId}/${input.safeName}`,
    objectKey: `inline/${input.userId}/${input.safeName}`,
    storageMode: "inline",
    storageProvider: "inline_data_url"
  };
}

export async function storeProfileUpload(input: StoreUploadInput): Promise<StoredUpload> {
  const mode = storageMode();
  if (mode === "r2") return storeR2Upload(input);
  if (mode === "inline") return storeInlineUpload(input);
  if (mode !== "local") throw new Error(`Unsupported upload storage mode: ${mode}`);
  return storeLocalUpload(input);
}
