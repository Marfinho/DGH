"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/auth";
import { parseDay, addDays, today } from "@/lib/dates";
import { parseIcs } from "@/lib/ics-import";
import { lookupAwsAbo, assertAllowedUrl, AwsError } from "@/lib/aws-waste";
import { syncSource } from "@/lib/waste-sync";

export type WasteResult = { ok?: string; error?: string; values?: Record<string, string> } | null;

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

const lbl = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 40) || null;

/** Quelle über die Adresse im AWS-Portal einrichten (Ort/Straße/Hausnummer), anschließend sofort abgleichen. */
export async function addAwsSource(_: WasteResult, fd: FormData): Promise<WasteResult> {
  await requireUser("ORGANISATOR");
  if (!rateLimit("aws-lookup", 10, 60 * 60_000)) return { error: "Zu viele Abfragen – bitte in einer Stunde erneut versuchen." };
  try {
    const a = await lookupAwsAbo({ ort: String(fd.get("ort") ?? ""), strasse: String(fd.get("strasse") ?? ""), hausnummer: String(fd.get("hausnummer") ?? ""), zusatz: String(fd.get("zusatz") ?? "") });
    const src = await db.wasteSource.create({ data: { name: `AWS Schaumburg – ${a.address}`, label: lbl(fd.get("label")), url: a.url } });
    const r = await syncSource(src.id);
    revalidatePath("/", "layout");
    return r.ok ? { ok: `Eingerichtet für ${a.address}: ${r.message}` } : { error: `Quelle angelegt, aber der Abgleich schlug fehl: ${r.message}` };
  } catch (e) { return { error: e instanceof AwsError ? e.message : "Unerwarteter Fehler.", values: Object.fromEntries(["ort", "strasse", "hausnummer", "zusatz", "label"].map((k) => [k, String(fd.get(k) ?? "")])) }; }
}

/** Quelle über die Abo-Adresse einrichten (aus dem AWS-Portal kopiert). */
export async function addUrlSource(_: WasteResult, fd: FormData): Promise<WasteResult> {
  await requireUser("ORGANISATOR");
  try {
    const u = assertAllowedUrl(String(fd.get("url") ?? ""));
    if (await db.wasteSource.count({ where: { url: u.toString() } })) return { error: "Diese Quelle ist schon eingerichtet." };
    const src = await db.wasteSource.create({ data: { name: `AWS Schaumburg (Abo-Adresse)`, label: lbl(fd.get("label")), url: u.toString() } });
    const r = await syncSource(src.id);
    revalidatePath("/", "layout");
    return r.ok ? { ok: r.message } : { error: `Quelle angelegt, aber der Abgleich schlug fehl: ${r.message}` };
  } catch (e) { return { error: e instanceof AwsError ? e.message : "Unerwarteter Fehler.", values: { url: String(fd.get("url") ?? ""), label: String(fd.get("label") ?? "") } }; }
}

export async function syncNow(fd: FormData) {
  await requireUser("ORGANISATOR");
  await syncSource(Number(fd.get("id")));
  revalidatePath("/", "layout");
}
export async function removeSource(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.wasteSource.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/", "layout");
}
