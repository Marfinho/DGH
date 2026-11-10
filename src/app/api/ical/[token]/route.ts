import { db } from "@/lib/db";
import { buildIcs, type IcsEvent } from "@/lib/ical";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await db.person.findUnique({ where: { calToken: token } });
  if (!p) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const since = new Date(Date.now() - 30 * 86_400_000);

  const events = await db.event.findMany({ where: { published: true, status: { not: "ARCHIVIERT" }, date: { gte: since } } });
  const out: IcsEvent[] = events.map((e) => ({ uid: `event-${e.id}`, title: e.title, date: e.date, location: e.location, description: e.description }));

  const slots = await db.helperSignup.findMany({ where: { personId: p.id, slot: { event: { date: { gte: since } } } }, include: { slot: { include: { event: true } } } });
  for (const s of slots) out.push({ uid: `slot-${s.id}`, title: `Helfen: ${s.slot.title} (${s.slot.event.title})`, date: s.slot.event.date, description: s.slot.timeText });

  const tasks = await db.task.findMany({ where: { assigneeId: p.id, status: { not: "ERLEDIGT" }, dueDate: { gte: since } }, include: { event: true } });
  for (const t of tasks) out.push({ uid: `task-${t.id}`, title: `Aufgabe: ${t.title} (${t.event.title})`, date: t.dueDate });

  if (url.searchParams.get("muell") === "1") {
    for (const w of await db.wasteDate.findMany({ where: { date: { gte: since } } })) out.push({ uid: `waste-${w.id}`, title: `🗑 ${w.type}`, date: w.date });
  }
  return new Response(buildIcs("Dorfplaner", out), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900" } });
}
