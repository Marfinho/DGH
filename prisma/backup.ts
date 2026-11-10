// Tägliches Backup:  npm run backup   (Compose-Dienst "backup" ruft das automatisch auf)
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { runBackup } from "../src/lib/backup";

const db = new PrismaClient();
runBackup(db, {
  backupDir: path.resolve(process.env.BACKUP_DIR ?? "./data/backups"),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads"),
  keep: Number(process.env.BACKUP_KEEP ?? 14),
})
  .then((r) => console.log(`Backup ok: ${r.file} (+${r.copiedUploads} neue Dateien, ${r.removed.length} alte Snapshots entfernt)`))
  .catch((e) => { console.error("Backup FEHLGESCHLAGEN:", e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
