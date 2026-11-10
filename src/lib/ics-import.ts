// Minimaler iCalendar-Import für Abfuhrkalender (.ics von Landkreis/Entsorger): Ganztags- und Zeittermine, einfache RRULE, EXDATE.
export type ParsedEvent = { type: string; date: Date };

const DAY = 86_400_000;
const unesc = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

function unfold(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

/** DTSTART/EXDATE-Wert -> Kalendertag (UTC-Mitternacht). UTC-Zeiten ("…Z") werden nach Europe/Berlin umgerechnet. */
export function icsDate(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  let [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (m[7] === "Z") {
    const utc = new Date(Date.UTC(y, mo - 1, d, +m[4], +m[5], +m[6]));
    const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(utc); // YYYY-MM-DD
    [y, mo, d] = p.split("-").map(Number);
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 ? date : null;
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function expand(start: Date, rule: string, exdates: Set<number>, horizon: Date): Date[] {
  const r: Record<string, string> = Object.fromEntries(rule.split(";").map((kv) => kv.split("=") as [string, string]));
  const freq = r.FREQ, interval = Math.max(1, Number(r.INTERVAL) || 1), count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? icsDate(r.UNTIL) : null;
  const limit = until && until < horizon ? until : horizon;
  const out: Date[] = [];
  const push = (d: Date) => { if (d <= limit && !exdates.has(+d)) out.push(d); };
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return [start];
  let n = 0;
  if (freq === "WEEKLY") {
    const days = (r.BYDAY ? r.BYDAY.split(",").map((x) => BYDAY.indexOf(x.slice(-2))) : [start.getUTCDay()]).filter((x) => x >= 0).sort();
    const weekStart = new Date(+start - ((start.getUTCDay() + 6) % 7) * DAY); // Montag der Startwoche
    for (let w = 0; n < count && +weekStart + w * 7 * DAY <= +limit + 7 * DAY; w += interval) {
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = new Date(+weekStart + (w * 7 + ((wd + 6) % 7)) * DAY);
        if (d < start) continue;
        if (n >= count) break;
        n++; push(d);
      }
    }
  } else {
    for (let i = 0; n < count; i += interval) {
      let d: Date;
      if (freq === "DAILY") d = new Date(+start + i * DAY);
      else if (freq === "MONTHLY") d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, start.getUTCDate()));
      else d = new Date(Date.UTC(start.getUTCFullYear() + i, start.getUTCMonth(), start.getUTCDate()));
      if (d > limit) break;
      n++; push(d);
      if (i > 5000) break;
    }
  }
  return out.length ? out : [];
}

export function parseIcs(text: string, opts: { horizonDays?: number; now?: Date } = {}): ParsedEvent[] {
  const now = opts.now ?? new Date();
  const horizon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + (opts.horizonDays ?? 730) * DAY);
  const lines = unfold(text);
  const out: ParsedEvent[] = [];
  let ev: { summary?: string; start?: Date; rrule?: string; ex: Set<number> } | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { ev = { ex: new Set() }; continue; }
    if (line === "END:VEVENT") {
      if (ev?.summary && ev.start) {
        const type = ev.summary.replace(/\s+/g, " ").trim().slice(0, 50);
        const dates = ev.rrule ? expand(ev.start, ev.rrule, ev.ex, horizon) : ev.ex.has(+ev.start) ? [] : [ev.start];
        for (const d of dates) out.push({ type, date: d });
      }
      ev = null; continue;
    }
    if (!ev) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const name = line.slice(0, i).split(";")[0].toUpperCase(), value = line.slice(i + 1);
    if (name === "SUMMARY") ev.summary = unesc(value);
    else if (name === "DTSTART") ev.start = icsDate(value) ?? undefined;
    else if (name === "RRULE") ev.rrule = value;
    else if (name === "EXDATE") for (const v of value.split(",")) { const d = icsDate(v); if (d) ev.ex.add(+d); }
    if (out.length > 20000) break;
  }
  return out;
}
