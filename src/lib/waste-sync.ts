import { db } from "./db";
import { today } from "./dates";
import { fetchIcs, AwsError } from "./aws-waste";
import { parseIcs } from "./ics-import";

export type SyncResult = { ok: boolean; count: number; message: string };

/** Gleicht eine Quelle ab: ersetzt deren zukünftige Termine durch den aktuellen Stand (Feiertagsverschiebungen!). Wirft nie. */
export async function syncSource(sourceId: number): Promise<SyncResult> {
  const src = await db.wasteSource.findUnique({ where: { id: sourceId } });
  if (!src) return { ok: false, count: 0, message: "Quelle nicht gefunden." };
  let res: SyncResult;
  try {
    const t = today();
    const rows = parseIcs(await fetchIcs(src.url), { now: new Date() }).filter((r) => r.date >= t);
    if (!rows.length) throw new AwsError("Der Kalender enthält keine zukünftigen Termine – bestehende Termine bleiben unverändert.");
    const label = src.label?.trim();
    const data = rows.map((r) => ({ type: label ? `${r.type} (${label})` : r.type, date: r.date }));
    const count = await db.$transaction(async (tx) => {
      await tx.wasteDate.deleteMany({ where: { sourceId: src.id, date: { gte: t } } });
      const have = new Set((await tx.wasteDate.findMany({ where: { date: { gte: t } }, select: { type: true, date: true } })).map((w) => `${w.type}|${+w.date}`));
      let n = 0;
      for (const d of data) { const k = `${d.type}|${+d.date}`; if (have.has(k)) continue; have.add(k); await tx.wasteDate.create({ data: { ...d, sourceId: src.id } }); n++; }
      return n;
    });
    res = { ok: true, count, message: `${data.length} Termine gelesen, ${count} übernommen.` };
  } catch (e) {
    res = { ok: false, count: 0, message: e instanceof AwsError ? e.message : "Unerwarteter Fehler beim Abgleich." };
    if (!(e instanceof AwsError)) console.error("Müll-Abgleich fehlgeschlagen:", e);
  }
  await db.wasteSource.update({ where: { id: src.id }, data: { lastSyncAt: new Date(), lastOk: res.ok, lastMessage: res.message, ...(res.ok ? { lastCount: res.count } : {}) } });
  return res;
}

export async function syncAllSources() {
  const out: Record<number, SyncResult> = {};
  for (const s of await db.wasteSource.findMany({ select: { id: true } })) out[s.id] = await syncSource(s.id);
  return out;
}
