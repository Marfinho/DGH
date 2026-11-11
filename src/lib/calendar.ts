// Monatsansicht: reine Logik (ohne Datenbank, testbar). Alle Tage als UTC-Mitternacht.
const DAY = 86_400_000;

export type CalKind = "TERMIN" | "VERSAMMLUNG" | "MUELL" | "LEIHEN" | "AUFGABE" | "UMFRAGE";
export const CAL_KINDS: CalKind[] = ["TERMIN", "VERSAMMLUNG", "MUELL", "LEIHEN", "AUFGABE", "UMFRAGE"];
export const CAL_LABEL: Record<CalKind, string> = { TERMIN: "Veranstaltungen", VERSAMMLUNG: "Versammlungen", MUELL: "Müllabfuhr", LEIHEN: "Reservierungen", AUFGABE: "Meine Fristen", UMFRAGE: "Umfragen" };

export type CalEntry = { kind: CalKind; title: string; start: Date; end?: Date; href?: string; note?: string; mine?: boolean; draft?: boolean };

/** Erster Tag des Monats aus "JJJJ-MM" (ungültig → Monat von fallback). */
export function parseMonth(s: string | undefined, fallback: Date): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 2000 && +m[1] <= 2100) return new Date(Date.UTC(+m[1], +m[2] - 1, 1));
  return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
}
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export const shiftMonth = (m: Date, n: number) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + n, 1));

/** Wochen (Mo–So) die den Monat vollständig abdecken, inkl. Randtagen der Nachbarmonate. */
export function monthGrid(month: Date): Date[][] {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  let d = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
  const weeks: Date[][] = [];
  while (d <= last) {
    const w: Date[] = [];
    for (let i = 0; i < 7; i++) { w.push(d); d = new Date(d.getTime() + DAY); }
    weeks.push(w);
  }
  return weeks;
}

/** Einträge je Tag (ISO-Schlüssel); mehrtägige Einträge erscheinen an jedem Tag im Bereich [from, to]. Sortiert nach Art. */
export function byDay(entries: CalEntry[], from: Date, to: Date): Map<string, CalEntry[]> {
  const map = new Map<string, CalEntry[]>();
  for (const e of entries) {
    const s = Math.max(e.start.getTime(), from.getTime()), end = Math.min((e.end ?? e.start).getTime(), to.getTime());
    for (let t = s; t <= end; t += DAY) {
      const k = new Date(t).toISOString().slice(0, 10);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
  }
  for (const list of map.values()) list.sort((a, b) => CAL_KINDS.indexOf(a.kind) - CAL_KINDS.indexOf(b.kind) || a.title.localeCompare(b.title, "de"));
  return map;
}

/** Filter aus "?zeige=TERMIN,MUELL"; leer/ungültig = alle. */
export function parseKinds(s: string | undefined): CalKind[] {
  const k = (s ?? "").split(",").filter((x): x is CalKind => CAL_KINDS.includes(x as CalKind));
  return k.length ? k : CAL_KINDS;
}
/** Filter-Link: Art an-/ausschalten (die letzte Art bleibt immer an). */
export function toggleKind(active: CalKind[], k: CalKind): CalKind[] {
  if (!active.includes(k)) return CAL_KINDS.filter((x) => x === k || active.includes(x));
  return active.length === 1 ? active : active.filter((x) => x !== k);
}
