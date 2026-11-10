import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { runBackup } from "./backup.ts";

test("Backup erzeugt Snapshot, spiegelt Uploads und räumt alte Snapshots auf", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "dp-bk-"));
  const up = path.join(dir, "up"), bk = path.join(dir, "bk");
  await mkdir(up);
  await writeFile(path.join(up, "a".repeat(32) + ".pdf"), "%PDF-x");
  const db = new PrismaClient();
  try {
    for (const d of ["2030-01-01", "2030-01-02", "2030-01-03"]) await runBackup(db, { backupDir: bk, uploadDir: up, keep: 2, now: new Date(d + "T12:00:00Z") });
    const files = (await readdir(bk)).sort();
    assert.deepEqual(files.filter((f) => f.endsWith(".db")), ["dorfplaner-2030-01-02.db", "dorfplaner-2030-01-03.db"]);
    assert.equal((await readdir(path.join(bk, "uploads"))).length, 1);
  } finally { await db.$disconnect(); }
});
