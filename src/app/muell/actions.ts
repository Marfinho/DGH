"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseDay, addDays, today } from "@/lib/dates";
import { parseIcs } from "@/lib/ics-import";

export type WasteResult = { ok?: string; error?: string } | null;

async function insert(rows: { type: string; date: Date }[]) {
  const existing = new Set((await db.wasteDate.findMany({ where: { type: { in: [...new Set(rows.map((r) => r.type))] } } })).map((w) => `${w.type}|${w.date.toISOString()}`));
  const fresh = rows.filter((r) => !existing.has(`${r.type}|${r.date.toISOString()}`));
  for (const r of fresh) await db.wasteDate.create({ data: r });
  revalidatePath("/", "layout");
  return fresh.length;
}

// CSV/Text: pro Zeile "JJJJ-MM-TT;Art" oder "TT.MM.JJJJ;Art" (Trennzeichen ; , oder Tab)
export async function importWaste(_: WasteResult, fd: FormData): Promise<WasteResult> {
  await requireUser("ORGANISATOR");
  const rows: { type: string; date: Date }[] = [];
  const bad: string[] = [];
  for (const raw of String(fd.get("csv") ?? "").split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const [d, ...rest] = line.split(/[;,\t]/); const type = rest.join(" ").trim();
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(d.trim());
    const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : d.trim();
    try { if (!type) throw new Error(); rows.push({ type, date: parseDay(iso) }); } catch { bad.push(line); }
  }
  if (!rows.length) return { error: bad.length ? `Keine gültige Zeile, z. B. fehlerhaft: ${bad[0]}` : "Nichts eingegeben." };
  const n = await insert(rows);
  return { ok: `${n} Termine übernommen${bad.length ? `, ${bad.length} Zeile(n) ignoriert (z. B. „${bad[0]}“)` : ""}.` };
}

export async function generateWaste(_: WasteResult, fd: FormData): Promise<WasteResult> {
  await requireUser("ORGANISATOR");
  const p = z.object({ type: z.string().trim().min(1).max(50), start: z.string(), every: z.coerce.number().int().min(1).max(366), count: z.coerce.number().int().min(1).max(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Bitte alle Felder ausfüllen." };
  let start: Date; try { start = parseDay(p.data.start); } catch { return { error: "Ungültiges Startdatum." }; }
  const n = await insert(Array.from({ length: p.data.count }, (_, i) => ({ type: p.data.type, date: addDays(start, i * p.data.every) })));
  return { ok: `${n} Termine erzeugt.` };
}

export async function deleteWasteType(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.wasteDate.deleteMany({ where: { type: String(fd.get("type")), date: { gte: today() } } });
  revalidatePath("/", "layout");
}

export async function importIcsFile(_: WasteResult, fd: FormData): Promise<WasteResult> {
  await requireUser("ORGANISATOR");
  const file = fd.get("file") as File | null;
  let text = String(fd.get("text") ?? "");
  if (file && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return { error: "Die Datei ist größer als 2 MB." };
    text = await file.text();
  }
  if (!text.trim()) return { error: "Bitte eine .ics-Datei auswählen oder den Inhalt einfügen." };
  if (!text.includes("BEGIN:VEVENT")) return { error: "Das sieht nicht nach einer Kalenderdatei (.ics) aus – es wurden keine Termine gefunden." };
  const t = today();
  const rows = parseIcs(text).filter((r) => r.date >= t);
  if (!rows.length) return { error: "In der Datei stehen keine zukünftigen Termine." };
  const types = [...new Set(rows.map((r) => r.type))];
  if (fd.get("replace") === "on") await db.wasteDate.deleteMany({ where: { type: { in: types }, date: { gte: t } } });
  const n = await insert(rows);
  const per = types.map((ty) => `${ty}: ${rows.filter((r) => r.type === ty).length}`).join(" · ");
  return { ok: `${n} neue Termine übernommen (${rows.length} in der Datei). ${per}` };
}
