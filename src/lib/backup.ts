import { mkdir, readdir, unlink, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

/** Konsistenter Snapshot der SQLite-Datenbank (auch bei laufendem Betrieb). Ziel darf nicht existieren. */
export async function snapshotDb(db: PrismaClient, dest: string) {
  if (!path.isAbsolute(dest) || dest.includes("'")) throw new Error("Ungültiger Zielpfad");
  await db.$executeRawUnsafe(`VACUUM INTO '${dest}'`);
}

export const dayStamp = (d = new Date()) => d.toISOString().slice(0, 10);

/** Tägliches Backup: DB-Snapshot + Spiegel der Uploads, behält die letzten `keep` Snapshots. */
export async function runBackup(db: PrismaClient, opts: { backupDir: string; uploadDir: string; keep?: number; now?: Date }) {
  const { backupDir, uploadDir, keep = 14 } = opts;
  await mkdir(backupDir, { recursive: true });
  const file = path.join(backupDir, `dorfplaner-${dayStamp(opts.now)}.db`);
  await unlink(file).catch(() => {}); // am selben Tag erneut: überschreiben
  await snapshotDb(db, file);

  // Uploads: Dateinamen sind Zufallsnamen und ändern sich nie -> nur Neues kopieren
  let copied = 0;
  const mirror = path.join(backupDir, "uploads");
  await mkdir(mirror, { recursive: true });
  for (const f of await readdir(uploadDir).catch(() => [] as string[])) {
    const dst = path.join(mirror, f);
    if (!(await stat(dst).catch(() => null))) { await copyFile(path.join(uploadDir, f), dst); copied++; }
  }

  const snaps = (await readdir(backupDir)).filter((f) => /^dorfplaner-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  const old = snaps.slice(0, Math.max(0, snaps.length - keep));
  for (const f of old) await unlink(path.join(backupDir, f));
  return { file, copiedUploads: copied, removed: old };
}
