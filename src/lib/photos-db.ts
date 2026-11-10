import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { UPLOAD_DIR, removeStored } from "./files";

/** Löscht Fotodateien (Datenbankzeilen werden per Cascade entfernt, wenn der Besitzer gelöscht wird). */
export async function removePhotosOf(where: { postId?: number; issueId?: number; authorId?: number }) {
  const photos = await db.photo.findMany({
    where: where.authorId ? { OR: [{ post: { authorId: where.authorId } }, { issue: { authorId: where.authorId } }] } : { postId: where.postId, issueId: where.issueId },
  });
  for (const p of photos) await removeStored(p.storedName);
}

/** Entfernt Dateien im Upload-Ordner, die zu nichts mehr gehören (älter als 1 Tag). */
export async function sweepOrphans() {
  const used = new Set([...(await db.attachment.findMany({ select: { storedName: true } })), ...(await db.photo.findMany({ select: { storedName: true } }))].map((x) => x.storedName));
  let removed = 0;
  for (const f of await readdir(UPLOAD_DIR).catch(() => [] as string[])) {
    if (used.has(f) || !/^[a-f0-9]{32}\.[a-z0-9]{2,5}$/.test(f)) continue;
    const st = await stat(path.join(UPLOAD_DIR, f)).catch(() => null);
    if (st && Date.now() - st.mtimeMs > 86_400_000) { await removeStored(f); removed++; }
  }
  return removed;
}
