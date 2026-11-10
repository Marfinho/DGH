import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { UPLOAD_DIR } from "./files.ts";

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export class PhotoError extends Error {}

/** Foto prüfen, verkleinern und neu kodieren – dabei fallen EXIF-Daten (GPS-Standort, Kamera, Zeit) weg. */
export async function storePhoto(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError("Das Foto ist größer als 12 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = buf.subarray(0, 12);
  const isJpg = sig.subarray(0, 3).toString("hex") === "ffd8ff";
  const isPng = sig.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const isWebp = sig.subarray(0, 4).toString("latin1") === "RIFF" && sig.subarray(8, 12).toString("latin1") === "WEBP";
  if (!isJpg && !isPng && !isWebp) throw new PhotoError("Bitte ein Foto als JPG, PNG oder WebP hochladen.");
  let out: Buffer;
  try {
    out = await sharp(buf, { failOn: "error", limitInputPixels: 60_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch { throw new PhotoError("Das Foto konnte nicht gelesen werden."); }
  const storedName = `${randomBytes(16).toString("hex")}.jpg`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), out, { mode: 0o640 });
  return storedName;
}

