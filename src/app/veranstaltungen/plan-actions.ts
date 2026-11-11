"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, logActivity } from "@/lib/db";
import { parseTime, nextMaterialStatus, MATERIAL_STATUS } from "@/lib/plan";

const txt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const refresh = (eventId: number, sub: string) => { revalidatePath(`/veranstaltungen/${eventId}/${sub}`); revalidatePath(`/veranstaltungen/${eventId}`); };

// ---------- Ablaufplan ----------
export async function saveScheduleItem(fd: FormData) {
  await requireUser("ORGANISATOR");
  const d = z.object({
    eventId: z.coerce.number().int(), id: z.coerce.number().int().optional(), dayOffset: z.coerce.number().int().min(-30).max(30),
    title: z.string().trim().min(1).max(200), place: txt(120), note: txt(500), time: txt(5), endTime: txt(5),
  }).parse(Object.fromEntries(fd));
  let time: string | null, endTime: string | null;
  try { time = parseTime(d.time); endTime = parseTime(d.endTime); }
  catch (e) { redirect(`/veranstaltungen/${d.eventId}/ablauf?fehler=${encodeURIComponent((e as Error).message)}`); }
  const responsibleId = Number(fd.get("responsibleId")) || null;
  const data = { dayOffset: d.dayOffset, time: time!, endTime: endTime!, title: d.title, place: d.place, note: d.note, isPublic: fd.get("isPublic") === "on", responsibleId };
  if (d.id) await db.scheduleItem.update({ where: { id: d.id, eventId: d.eventId }, data });
  else { await db.scheduleItem.create({ data: { ...data, eventId: d.eventId } }); await logActivity(d.eventId, `Ablauf: „${d.title}“ hinzugefügt`); }
  refresh(d.eventId, "ablauf");
}

export async function deleteScheduleItem(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  await db.scheduleItem.delete({ where: { id: Number(fd.get("id")), eventId } });
  refresh(eventId, "ablauf");
}

// ---------- Material & Einkauf ----------
export async function saveMaterial(fd: FormData) {
  await requireUser("ORGANISATOR");
  const d = z.object({
    eventId: z.coerce.number().int(), id: z.coerce.number().int().optional(), title: z.string().trim().min(1).max(200),
    quantity: txt(60), source: txt(120), note: txt(500), status: z.enum(MATERIAL_STATUS).optional(),
  }).parse(Object.fromEntries(fd));
  const data = { title: d.title, quantity: d.quantity, source: d.source, note: d.note, responsibleId: Number(fd.get("responsibleId")) || null, ...(d.status ? { status: d.status } : {}) };
  if (d.id) await db.materialItem.update({ where: { id: d.id, eventId: d.eventId }, data });
  else await db.materialItem.create({ data: { ...data, eventId: d.eventId, sort: await db.materialItem.count({ where: { eventId: d.eventId } }) } });
  refresh(d.eventId, "material");
}

export async function cycleMaterial(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  const m = await db.materialItem.findUniqueOrThrow({ where: { id: Number(fd.get("id")), eventId } });
  await db.materialItem.update({ where: { id: m.id }, data: { status: nextMaterialStatus(m.status) } });
  refresh(eventId, "material");
}

export async function assignMaterial(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  await db.materialItem.update({ where: { id: Number(fd.get("id")), eventId }, data: { responsibleId: Number(fd.get("responsibleId")) || null } });
  refresh(eventId, "material");
}

export async function deleteMaterial(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  await db.materialItem.delete({ where: { id: Number(fd.get("id")), eventId } });
  refresh(eventId, "material");
}
