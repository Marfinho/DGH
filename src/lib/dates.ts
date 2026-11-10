// Alle Termine sind reine Kalendertage, gespeichert als UTC-Mitternacht.
const DAY = 86_400_000;

export function parseDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Ungültiges Datum: ${s}`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.toISOString().slice(0, 10) !== s) throw new Error(`Ungültiges Datum: ${s}`);
  return d;
}

export const toInput = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

export function today(): Date {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  return parseDay(p);
}

export const formatDay = (d: Date) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);

export function relativeLabel(offset: number): string {
  if (offset === 0) return "am Veranstaltungstag";
  const n = Math.abs(offset);
  return `${n} ${n === 1 ? "Tag" : "Tage"} ${offset < 0 ? "vorher" : "danach"}`;
}
