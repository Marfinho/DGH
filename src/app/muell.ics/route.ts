import { db } from "@/lib/db";
import { today, addDays } from "@/lib/dates";
import { buildIcs } from "@/lib/ical";

// Öffentlicher Abfall-Kalender (keine personenbezogenen Daten): /muell.ics[?art=Bio,Papier][&erinnerung=1][&dl=1]
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const only = (q.get("art") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const t = today();
  const rows = await db.wasteDate.findMany({ where: { date: { gte: addDays(t, -14) }, ...(only.length ? { type: { in: only } } : {}) }, orderBy: { date: "asc" } });
  const alarm = q.get("erinnerung") === "1";
  const body = buildIcs(only.length ? `Müllabfuhr (${only.join(", ")})` : "Müllabfuhr", rows.map((w) => ({ uid: `waste-${w.id}`, title: `Müllabfuhr: ${w.type}`, date: w.date, alarmEveningBefore: alarm })));
  return new Response(body, { headers: {
    "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=900",
    ...(q.get("dl") ? { "content-disposition": 'attachment; filename="muellabfuhr.ics"' } : {}),
  } });
}
