// Ablaufplan und Materialliste: reine Logik (ohne Datenbank, testbar)
const DAY = 86_400_000;

/** "9:5" → Fehler, "9:05" → "09:05", "" → null. */
export function parseTime(s: string | null | undefined): string | null {
  const v = (s ?? "").trim();
  if (!v) return null;
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(v);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`Ungültige Uhrzeit: ${v} (Format 18:30)`);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

type Sched = { dayOffset: number; time: string | null; title: string };
/** Nach Tag, dann Uhrzeit (ohne Uhrzeit zuerst = „ganztägig“), dann Titel. */
export function sortSchedule<T extends Sched>(items: T[]): T[] {
  return [...items].sort((a, b) => a.dayOffset - b.dayOffset || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title, "de"));
}

/** Gruppiert sortierte Einträge nach Tag. */
export function groupByDay<T extends Sched>(items: T[]): { dayOffset: number; items: T[] }[] {
  const out: { dayOffset: number; items: T[] }[] = [];
  for (const it of sortSchedule(items)) {
    const last = out.at(-1);
    if (last && last.dayOffset === it.dayOffset) last.items.push(it); else out.push({ dayOffset: it.dayOffset, items: [it] });
  }
  return out;
}

/** Überschrift für einen Tag relativ zur Veranstaltung, z. B. "Fr., 03.04.2026 · Vortag". */
export function dayHeading(eventDate: Date, offset: number): string {
  const d = new Date(eventDate.getTime() + offset * DAY);
  const f = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);
  const rel = offset === 0 ? "Veranstaltungstag" : offset === -1 ? "Vortag" : offset === 1 ? "Tag danach" : offset < 0 ? `${-offset} Tage vorher` : `${offset} Tage danach`;
  return `${f} · ${rel}`;
}

export const timeRange = (t: string | null, e: string | null) => (t ? (e ? `${t}–${e}` : t) : e ? `bis ${e}` : "");

export const MATERIAL_STATUS = ["OFFEN", "ORGANISIERT", "VOR_ORT"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUS)[number];
export const MATERIAL_LABEL: Record<MaterialStatus, string> = { OFFEN: "Offen", ORGANISIERT: "Organisiert", VOR_ORT: "Vor Ort" };
export const nextMaterialStatus = (s: string): MaterialStatus => MATERIAL_STATUS[(MATERIAL_STATUS.indexOf(s as MaterialStatus) + 1) % MATERIAL_STATUS.length];

export function materialSummary(items: { status: string }[]) {
  const c = { OFFEN: 0, ORGANISIERT: 0, VOR_ORT: 0 } as Record<MaterialStatus, number>;
  for (const i of items) if (i.status in c) c[i.status as MaterialStatus]++;
  return { ...c, total: items.length, done: c.ORGANISIERT + c.VOR_ORT };
}
