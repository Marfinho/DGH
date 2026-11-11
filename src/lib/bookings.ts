// Reine Logik für Reservierungen (ganze Kalendertage, UTC-Mitternacht; ohne Datenbank, testbar)

export const BOOKING_STATUS = ["ANGEFRAGT", "BESTAETIGT", "ABGELEHNT", "STORNIERT"] as const;
export type BookingStatus = (typeof BOOKING_STATUS)[number];
export const BOOKING_LABEL: Record<BookingStatus, string> = { ANGEFRAGT: "Angefragt", BESTAETIGT: "Bestätigt", ABGELEHNT: "Abgelehnt", STORNIERT: "Storniert" };
/** Diese Status halten den Zeitraum frei für die buchende Person. */
export const BLOCKING: BookingStatus[] = ["ANGEFRAGT", "BESTAETIGT"];
export const RESOURCE_KINDS = ["RAUM", "GERAET"] as const;
export const RESOURCE_LABEL: Record<(typeof RESOURCE_KINDS)[number], string> = { RAUM: "Raum", GERAET: "Gerät / Inventar" };

export const MAX_DAYS = 14; // längste Reservierung am Stück
export const MAX_AHEAD_DAYS = 548; // höchstens ~1,5 Jahre im Voraus
const DAY = 86_400_000;

type Range = { startDate: Date; endDate: Date };

/** Zwei Tagesbereiche (jeweils inklusive) überschneiden sich. */
export const overlaps = (a: Range, b: Range) => a.startDate.getTime() <= b.endDate.getTime() && b.startDate.getTime() <= a.endDate.getTime();

/** Erste blockierende Reservierung, die mit dem Bereich kollidiert (ignoreId = die Reservierung selbst). */
export function findConflict<T extends Range & { id: number; status: string }>(range: Range, others: T[], ignoreId?: number): T | undefined {
  return others.find((o) => o.id !== ignoreId && BLOCKING.includes(o.status as BookingStatus) && overlaps(range, o));
}

/** Prüft einen gewünschten Zeitraum; wirft Fehler mit deutscher Meldung. */
export function validateRange(r: Range, today: Date) {
  const days = Math.round((r.endDate.getTime() - r.startDate.getTime()) / DAY) + 1;
  if (days < 1) throw new Error("Das Ende darf nicht vor dem Beginn liegen.");
  if (r.startDate.getTime() < today.getTime()) throw new Error("Reservierungen in der Vergangenheit sind nicht möglich.");
  if (days > MAX_DAYS) throw new Error(`Höchstens ${MAX_DAYS} Tage am Stück.`);
  if ((r.startDate.getTime() - today.getTime()) / DAY > MAX_AHEAD_DAYS) throw new Error("So weit im Voraus kann noch nicht reserviert werden.");
  return days;
}

/** Belegte Tage (ISO yyyy-mm-dd) eines Monats für die Kalenderansicht: "BESTAETIGT" gewinnt vor "ANGEFRAGT". */
export function occupancy(bookings: (Range & { status: string })[], from: Date, to: Date): Map<string, BookingStatus> {
  const map = new Map<string, BookingStatus>();
  for (const b of bookings) {
    if (!BLOCKING.includes(b.status as BookingStatus)) continue;
    const s = Math.max(b.startDate.getTime(), from.getTime()), e = Math.min(b.endDate.getTime(), to.getTime());
    for (let t = s; t <= e; t += DAY) {
      const k = new Date(t).toISOString().slice(0, 10);
      if (map.get(k) !== "BESTAETIGT") map.set(k, b.status as BookingStatus);
    }
  }
  return map;
}
