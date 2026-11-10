// Minimaler iCalendar-Generator (RFC 5545), nur Ganztagstermine
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
function fold(line: string) {
  const out: string[] = []; let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 73) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}
export type IcsEvent = { uid: string; title: string; date: Date; location?: string | null; description?: string | null; alarmEveningBefore?: boolean };

export function buildIcs(name: string, events: IcsEvent[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dorfplaner//DE", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Europe/Berlin"];
  for (const e of events) {
    const next = new Date(e.date.getTime() + 86_400_000);
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@dorfplaner`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(next)}`, `SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.alarmEveningBefore) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)} morgen`, "TRIGGER:-PT6H", "END:VALARM"); // 18:00 am Vorabend
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
