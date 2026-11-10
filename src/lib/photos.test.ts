import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { storePhoto, PhotoError } from "./photos.ts";
import { UPLOAD_DIR, removeStored } from "./files.ts";

test("Foto wird neu kodiert, verkleinert und EXIF (GPS) entfernt", async () => {
  const src = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#336" } }).jpeg().withExif({ IFD0: { Copyright: "geheim", Make: "TestKamera" } }).toBuffer();
  assert.ok((await sharp(src).metadata()).exif, "Testbild sollte EXIF enthalten");
  const name = await storePhoto(new File([src as BlobPart], "x.jpg"));
  assert.ok(name && /^[a-f0-9]{32}\.jpg$/.test(name));
  const out = await readFile(path.join(UPLOAD_DIR, name!));
  const meta = await sharp(out).metadata();
  assert.equal(meta.exif, undefined);
  assert.ok(meta.width! <= 1600 && meta.height! <= 1600);
  await removeStored(name!);
});
test("Kein Bild wird abgelehnt", async () => {
  await assert.rejects(storePhoto(new File([new TextEncoder().encode("%PDF-1.4") as BlobPart], "a.jpg")), PhotoError);
  assert.equal(await storePhoto(null), null);
});
