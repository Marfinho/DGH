"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hasRole, rateLimit } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { parseDay, today, formatDay } from "@/lib/dates";
import { BLOCKING, RESOURCE_KINDS, findConflict, validateRange } from "@/lib/bookings";

const refresh = () => { revalidatePath("/reservierung"); revalidatePath("/"); };
const fail = (msg: string): never => redirect(`/reservierung?fehler=${encodeURIComponent(msg)}`);
const span = (s: Date, e: Date) => (s.getTime() === e.getTime() ? formatDay(s) : `${formatDay(s)} – ${formatDay(e)}`);
const orgaIds = async () => (await db.person.findMany({ where: { role: { in: ["ORGANISATOR", "ADMIN"] } }, select: { id: true } })).map((p) => p.id);

class Conflict extends Error {}

export async function requestBooking(fd: FormData) {
  const me = await requireUser();
  const d = z.object({
    resourceId: z.coerce.number().int(), start: z.string(), end: z.string().optional(),
    timeText: z.string().trim().max(60).optional(), purpose: z.string().trim().min(3).max(500),
  }).safeParse(Object.fromEntries(fd));
  if (!d.success) fail("Bitte Gegenstand, Datum und Zweck (mind. 3 Zeichen) angeben.");
  const v = d.data!;
  if (!rateLimit(`booking:${me.id}`, 10, 24 * 3600_000)) fail("Heute sind es genug Anfragen – bitte morgen wieder.");
  let startDate: Date, endDate: Date;
  try { startDate = parseDay(v.start); endDate = v.end ? parseDay(v.end) : startDate; validateRange({ startDate, endDate }, today()); }
  catch (e) { fail((e as Error).message); }
  const res = await db.resource.findUnique({ where: { id: v.resourceId } });
  if (!res || !res.active) fail("Diesen Gegenstand gibt es nicht (mehr).");
  const status = res!.needsApproval ? "ANGEFRAGT" : "BESTAETIGT";
  try {
    // Prüfen und Anlegen in einer Transaktion, damit niemand denselben Zeitraum gleichzeitig bekommt
    await db.$transaction(async (tx) => {
      const others = await tx.booking.findMany({ where: { resourceId: res!.id, status: { in: BLOCKING }, startDate: { lte: endDate! }, endDate: { gte: startDate! } } });
      if (findConflict({ startDate: startDate!, endDate: endDate! }, others)) throw new Conflict();
      await tx.booking.create({ data: { resourceId: res!.id, personId: me.id, startDate: startDate!, endDate: endDate!, timeText: v.timeText || null, purpose: v.purpose, status } });
    });
  } catch (e) { if (e instanceof Conflict) fail(`${res!.name} ist in diesem Zeitraum schon vergeben.`); throw e; }
  if (status === "ANGEFRAGT") await sendPush({ title: `Reservierungsanfrage: ${res!.name}`, body: `${me.name} · ${span(startDate!, endDate!)}`, url: "/reservierung" }, (await orgaIds()).filter((id) => id !== me.id)).catch(() => {});
  refresh();
  redirect(`/reservierung?ok=${status === "BESTAETIGT" ? "bestaetigt" : "angefragt"}`);
}

export async function decideBooking(decisionRaw: string, fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  const decision = z.enum(["BESTAETIGT", "ABGELEHNT"]).parse(decisionRaw);
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  const b = await db.booking.findUniqueOrThrow({ where: { id }, include: { resource: true } });
  if (b.status !== "ANGEFRAGT") fail("Diese Anfrage wurde schon bearbeitet.");
  if (decision === "BESTAETIGT") {
    const others = await db.booking.findMany({ where: { resourceId: b.resourceId, status: "BESTAETIGT", startDate: { lte: b.endDate }, endDate: { gte: b.startDate } } });
    if (findConflict(b, others, b.id)) fail("Der Zeitraum ist inzwischen anderweitig bestätigt.");
  }
  await db.booking.update({ where: { id }, data: { status: decision, note, decidedById: me.id, decidedAt: new Date() } });
  await sendPush({ title: decision === "BESTAETIGT" ? `Reservierung bestätigt: ${b.resource.name}` : `Reservierung abgelehnt: ${b.resource.name}`, body: `${span(b.startDate, b.endDate)}${note ? ` – ${note}` : ""}`, url: "/reservierung" }, [b.personId]).catch(() => {});
  refresh();
}

export async function cancelBooking(fd: FormData) {
  const me = await requireUser();
  const b = await db.booking.findUniqueOrThrow({ where: { id: Number(fd.get("id")) }, include: { resource: true } });
  const own = b.personId === me.id;
  if (!own && !hasRole(me, "ORGANISATOR")) throw new Error("Keine Berechtigung");
  if (!BLOCKING.includes(b.status as (typeof BLOCKING)[number])) fail("Diese Reservierung ist nicht mehr aktiv.");
  await db.booking.update({ where: { id: b.id }, data: { status: "STORNIERT", ...(own ? {} : { decidedById: me.id, decidedAt: new Date(), note: String(fd.get("note") ?? "").trim().slice(0, 500) || "von der Orga storniert" }) } });
  if (!own) await sendPush({ title: `Reservierung storniert: ${b.resource.name}`, body: span(b.startDate, b.endDate), url: "/reservierung" }, [b.personId]).catch(() => {});
  refresh();
}

export async function saveResource(fd: FormData) {
  await requireUser("ORGANISATOR");
  const d = z.object({
    id: z.coerce.number().int().optional(), name: z.string().trim().min(2).max(120), kind: z.enum(RESOURCE_KINDS),
    description: z.string().trim().max(1000).optional(), handover: z.string().trim().max(300).optional(),
  }).parse(Object.fromEntries(fd));
  const data = { name: d.name, kind: d.kind, description: d.description || null, handover: d.handover || null, needsApproval: fd.get("needsApproval") === "on" };
  if (d.id) await db.resource.update({ where: { id: d.id }, data });
  else await db.resource.create({ data });
  refresh();
}

export async function toggleResource(fd: FormData) {
  await requireUser("ORGANISATOR");
  const r = await db.resource.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
  await db.resource.update({ where: { id: r.id }, data: { active: !r.active } });
  refresh();
}

export async function deleteResource(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  if (await db.booking.count({ where: { resourceId: id, status: { in: BLOCKING }, endDate: { gte: today() } } })) fail("Es gibt noch aktive Reservierungen – bitte erst stornieren oder den Gegenstand deaktivieren.");
  await db.resource.delete({ where: { id } });
  refresh();
}
