// Minimaler iCalendar-Generator (RFC 5545): Ganztagstermine und Termine mit Uhrzeit (Ortszeit Berlin, als UTC ausgegeben)
export const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

/** Minuten, die Berlin zu einem Zeitpunkt vor UTC liegt (60 im Winter, 120 im Sommer). */
function berlinOffsetMin(at: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(at.getTime() / 60000) * 60000) / 60000;
}
/** Kalendertag (UTC-Mitternacht) + "HH:MM" Ortszeit Berlin → Zeitpunkt. */
export function berlinTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const local = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m);
  let t = local - berlinOffsetMin(new Date(local)) * 60000;
  t = local - berlinOffsetMin(new Date(t)) * 60000; // an Umstellungstagen nachjustieren
  return new Date(t);
}
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
function fold(line: string) {
  const out: string[] = []; let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 73) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}
export type IcsEvent = { uid: string; title: string; date: Date; startTime?: string | null; endTime?: string | null; location?: string | null; description?: string | null; alarmEveningBefore?: boolean };

export function buildIcs(name: string, events: IcsEvent[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dorfplaner//DE", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Europe/Berlin"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@dorfplaner`, `DTSTAMP:${stamp}`);
    if (e.startTime) {
      const start = berlinTime(e.date, e.startTime);
      const end = e.endTime && e.endTime > e.startTime ? berlinTime(e.date, e.endTime) : new Date(start.getTime() + 2 * 3600_000); // ohne Ende: 2 Stunden
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(new Date(e.date.getTime() + 86_400_000))}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.alarmEveningBefore) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)} morgen`, "TRIGGER:-PT6H", "END:VALARM"); // 18:00 am Vorabend
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
