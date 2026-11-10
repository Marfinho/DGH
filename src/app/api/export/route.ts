import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

// DSGVO Art. 15/20: alle zu mir gespeicherten Daten als JSON
export async function GET() {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const [profile, tasks, signups, rsvps, push] = await Promise.all([
    db.person.findUniqueOrThrow({ where: { id: u.id }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true } }),
    db.task.findMany({ where: { assigneeId: u.id }, select: { title: true, dueDate: true, status: true, event: { select: { title: true } } } }),
    db.helperSignup.findMany({ where: { personId: u.id }, select: { createdAt: true, slot: { select: { title: true, event: { select: { title: true, date: true } } } } } }),
    db.rsvp.findMany({ where: { personId: u.id }, select: { status: true, guests: true, event: { select: { title: true, date: true } } } }),
    db.pushSubscription.count({ where: { personId: u.id } }),
  ]);
  return new Response(JSON.stringify({ exportiertAm: new Date().toISOString(), profil: profile, aufgaben: tasks, helferEintraege: signups, zusagen: rsvps, pushGeraete: push }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="meine-daten.json"' },
  });
}
