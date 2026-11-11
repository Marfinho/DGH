import { db } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { buildIcs } from "@/lib/ical";

// Kalenderdatei einer Versammlung (nur Orga) – Rückfall, wenn kein Mailversand eingerichtet ist
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u || !hasRole(u, "ORGANISATOR")) return new Response("Not found", { status: 404 });
  const m = await db.meeting.findUnique({ where: { id: Number((await params).id) }, include: { agenda: { orderBy: [{ sort: "asc" }, { id: "asc" }] } } });
  if (!m) return new Response("Not found", { status: 404 });
  const ics = buildIcs(m.title, [{ uid: `meeting-${m.id}`, title: m.title, date: m.date, startTime: m.startTime, endTime: m.endTime, location: m.location, description: m.agenda.map((a, i) => `${i + 1}. ${a.title}`).join("\n") }]);
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="versammlung-${m.id}.ics"` } });
}
