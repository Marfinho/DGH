import { test } from "node:test";
import assert from "node:assert/strict";
import { storeUpload, readStored, removeStored, UploadError } from "./files.ts";

const f = (bytes: Uint8Array, name: string) => new File([bytes as BlobPart], name);

test("PDF mit passender Signatur wird gespeichert und wieder gelesen", async () => {
  const r = await storeUpload(f(new TextEncoder().encode("%PDF-1.4 test"), "Rechnung März.pdf"));
  assert.match(r.storedName, /^[a-f0-9]{32}\.pdf$/);
  assert.equal(r.mime, "application/pdf");
  assert.equal((await readStored(r.storedName)).toString().startsWith("%PDF"), true);
  await removeStored(r.storedName);
});
test("Falsche Endung oder Inhalt wird abgelehnt", async () => {
  await assert.rejects(storeUpload(f(new TextEncoder().encode("<?php echo 1;"), "x.php")), UploadError);
  await assert.rejects(storeUpload(f(new TextEncoder().encode("MZ binary"), "x.pdf")), UploadError);
  await assert.rejects(storeUpload(f(new Uint8Array(), "leer.pdf")), UploadError);
});
test("Pfadtricks beim Lesen werden abgelehnt", async () => {
  await assert.rejects(readStored("../../etc/passwd"));
});
