import { readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { snapshotDb, dayStamp } from "@/lib/backup";

// Nur Admins: aktueller Datenbank-Snapshot zum Download (Uploads liegen im Server-Backup)
export async function GET() {
  const u = await getUser();
  if (!u || !hasRole(u, "ADMIN")) return new Response("Not found", { status: 404 });
  const dir = await mkdtemp(path.join(tmpdir(), "dp-backup-"));
  const file = path.join(dir, "snapshot.db");
  try {
    await snapshotDb(db, file);
    const data = await readFile(file);
    return new Response(new Uint8Array(data), { headers: { "content-type": "application/octet-stream", "content-disposition": `attachment; filename="dorfplaner-${dayStamp()}.db"`, "cache-control": "no-store" } });
  } finally { await unlink(file).catch(() => {}); }
}
