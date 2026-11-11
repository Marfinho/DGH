import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

// DSGVO Art. 15/20: alle zu mir gespeicherten Daten als JSON
export async function GET() {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const [profile, tasks, signups, rsvps, push, roles, requests, posts, issues, votes, bookings, polls] = await Promise.all([
    db.person.findUniqueOrThrow({ where: { id: u.id }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true } }),
    db.task.findMany({ where: { assigneeId: u.id }, select: { title: true, dueDate: true, status: true, event: { select: { title: true } } } }),
    db.helperSignup.findMany({ where: { personId: u.id }, select: { createdAt: true, slot: { select: { title: true, event: { select: { title: true, date: true } } } } } }),
    db.rsvp.findMany({ where: { personId: u.id }, select: { status: true, guests: true, event: { select: { title: true, date: true } } } }),
    db.pushSubscription.count({ where: { personId: u.id } }),
    db.eventMember.findMany({ where: { personId: u.id }, select: { role: true, event: { select: { title: true, date: true } } } }),
    db.budgetItem.findMany({ where: { OR: [{ requestedById: u.id }, { decidedById: u.id }] }, select: { title: true, plannedCents: true, status: true, event: { select: { title: true } } } }),
    db.boardPost.findMany({ where: { authorId: u.id }, select: { category: true, kind: true, title: true, body: true, contact: true, createdAt: true } }),
    db.issue.findMany({ where: { authorId: u.id }, select: { category: true, title: true, description: true, locationText: true, lat: true, lng: true, status: true, createdAt: true } }),
    db.pollVote.findMany({ where: { personId: u.id }, select: { createdAt: true, poll: { select: { title: true } }, option: { select: { text: true } } } }),
    db.booking.findMany({ where: { personId: u.id }, select: { startDate: true, endDate: true, timeText: true, purpose: true, status: true, note: true, createdAt: true, resource: { select: { name: true } } } }),
    db.poll.findMany({ where: { createdById: u.id }, select: { title: true, createdAt: true } }),
  ]);
  return new Response(JSON.stringify({ exportiertAm: new Date().toISOString(), profil: profile, aufgaben: tasks, helferEintraege: signups, zusagen: rsvps, pushGeraete: push, rollenBeiVeranstaltungen: roles, budgetAntraegeUndEntscheidungen: requests, schwarzesBrettUndFundbuero: posts, anliegen: issues, umfrageStimmen: votes, erstellteUmfragen: polls, reservierungen: bookings, muellErinnerung: { aktiv: u.wastePush, tonnen: u.wasteTypes } }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="meine-daten.json"' },
  });
}
