import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { today, addDays } from "@/lib/dates";
import { sendPush } from "@/lib/push";

// Täglich aufrufen, z. B.: curl -H "Authorization: Bearer $CRON_SECRET" https://DOMAIN/api/cron/reminders
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given), b = Buffer.from(secret ?? "");
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Unauthorized", { status: 401 });

  const t = today();
  let sent = 0;
  // 1) Aufgaben: überfällig oder in den nächsten 2 Tagen fällig
  const tasks = await db.task.findMany({ where: { status: { not: "ERLEDIGT" }, assigneeId: { not: null }, dueDate: { lte: addDays(t, 2) }, event: { status: "GEPLANT" } } });
  const byPerson = new Map<number, typeof tasks>();
  for (const x of tasks) byPerson.set(x.assigneeId!, [...(byPerson.get(x.assigneeId!) ?? []), x]);
  for (const [pid, list] of byPerson) {
    const overdue = list.filter((x) => x.dueDate < t).length;
    sent += await sendPush({ title: "Erinnerung: offene Aufgaben", body: `${list.length} Aufgabe(n) fällig${overdue ? `, davon ${overdue} überfällig` : ""}: ${list[0].title}${list.length > 1 ? " …" : ""}`, url: "/meine-aufgaben" }, [pid]);
  }
  // 2) Veranstaltung morgen: an alle mit Zusage oder Helfer-Slot
  const events = await db.event.findMany({ where: { published: true, date: addDays(t, 1) }, include: { rsvps: { where: { status: "JA" } }, slots: { include: { signups: true } } } });
  for (const e of events) {
    const ids = new Set<number>([...e.rsvps.map((r) => r.personId), ...e.slots.flatMap((s) => s.signups.map((x) => x.personId))]);
    if (ids.size) sent += await sendPush({ title: `Morgen: ${e.title}`, body: e.location ? `Ort: ${e.location}` : "Wir freuen uns auf dich!", url: `/veranstaltungen/${e.id}` }, [...ids]);
  }
  return Response.json({ ok: true, sent });
}
