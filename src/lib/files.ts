import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
export const MAX_BYTES = 10 * 1024 * 1024;

// Erlaubte Typen: Endung -> MIME (der Browser-MIME wird ignoriert) + Signaturprüfung
const TYPES: Record<string, { mime: string; check: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", check: (b) => b.subarray(0, 4).toString("latin1") === "%PDF" },
  png: { mime: "image/png", check: (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" },
  jpg: { mime: "image/jpeg", check: (b) => b.subarray(0, 3).toString("hex") === "ffd8ff" },
  jpeg: { mime: "image/jpeg", check: (b) => b.subarray(0, 3).toString("hex") === "ffd8ff" },
  webp: { mime: "image/webp", check: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", check: (b) => b.subarray(0, 2).toString("latin1") === "PK" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", check: (b) => b.subarray(0, 2).toString("latin1") === "PK" },
  odt: { mime: "application/vnd.oasis.opendocument.text", check: (b) => b.subarray(0, 2).toString("latin1") === "PK" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", check: (b) => b.subarray(0, 2).toString("latin1") === "PK" },
  txt: { mime: "text/plain; charset=utf-8", check: (b) => !b.includes(0) },
  csv: { mime: "text/csv; charset=utf-8", check: (b) => !b.includes(0) },
};
export const ALLOWED_EXT = Object.keys(TYPES);

export class UploadError extends Error {}

export async function storeUpload(file: File): Promise<{ name: string; storedName: string; mime: string; size: number }> {
  if (!file || file.size === 0) throw new UploadError("Bitte eine Datei auswählen.");
  if (file.size > MAX_BYTES) throw new UploadError("Die Datei ist größer als 10 MB.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const t = TYPES[ext];
  if (!t) throw new UploadError(`Dateityp .${ext} ist nicht erlaubt (erlaubt: ${ALLOWED_EXT.join(", ")}).`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!t.check(buf)) throw new UploadError("Der Dateiinhalt passt nicht zur Endung.");
  const storedName = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), buf, { mode: 0o640 });
  const name = file.name.replace(/[\u0000-\u001f\\/]/g, "_").slice(0, 150) || `datei.${ext}`;
  return { name, storedName, mime: t.mime, size: buf.length };
}

const safePath = (storedName: string) => {
  if (!/^[a-f0-9]{32}\.[a-z0-9]{2,5}$/.test(storedName)) throw new Error("Ungültiger Dateiname");
  return path.join(UPLOAD_DIR, storedName);
};
export const readStored = async (storedName: string) => readFile(safePath(storedName));
export const removeStored = async (storedName: string) => { await unlink(safePath(storedName)).catch(() => {}); };

export const formatSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
