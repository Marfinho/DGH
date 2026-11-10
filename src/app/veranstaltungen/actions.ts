"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, hasRole } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { db, logActivity } from "@/lib/db";
import { parseDay, addDays, diffDays } from "@/lib/dates";
import { createEventFromTemplate, saveEventAsTemplate } from "@/lib/template";
import { TASK_STATUS, EVENT_STATUS, TASK_LABEL, type TaskStatus } from "@/lib/constants";

const title = z.string().trim().min(1).max(200);
const opt = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const refresh = (id: number | string) => revalidatePath(`/veranstaltungen/${id}`);

export async function createEvent(fd: FormData) {
  await requireUser("ORGANISATOR");
  const ev = await createEventFromTemplate({
    title: title.parse(fd.get("title")), date: parseDay(String(fd.get("date"))),
    location: opt(fd.get("location")), templateId: Number(fd.get("templateId")) || null,
  });
  redirect(`/veranstaltungen/${ev.id}`);
}

export async function updateEvent(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  const old = await db.event.findUniqueOrThrow({ where: { id } });
  const date = parseDay(String(fd.get("date")));
  const shift = fd.get("shift") === "on" ? diffDays(date, old.date) : 0;
  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id }, data: {
      title: title.parse(fd.get("title")), date, location: opt(fd.get("location")), description: opt(fd.get("description")),
      status: z.enum(EVENT_STATUS).parse(fd.get("status")),
      published: fd.get("published") === "on",
    } });
    if (shift) {
      for (const m of await tx.milestone.findMany({ where: { eventId: id } })) await tx.milestone.update({ where: { id: m.id }, data: { dueDate: addDays(m.dueDate, shift) } });
      for (const t of await tx.task.findMany({ where: { eventId: id } })) await tx.task.update({ where: { id: t.id }, data: { dueDate: addDays(t.dueDate, shift) } });
    }
    await tx.activityLog.create({ data: { eventId: id, text: shift ? `Event um ${shift} Tage verschoben, alle Fristen angepasst` : "Veranstaltungsdaten geändert" } });
  });
  refresh(id);
}

export async function saveLessons(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  await db.event.update({ where: { id }, data: { lessonsLearned: opt(fd.get("lessonsLearned")) } });
  await logActivity(id, "Lessons Learned aktualisiert");
  refresh(id);
}

export async function deleteEvent(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.event.delete({ where: { id: Number(fd.get("id")) } });
  redirect("/veranstaltungen");
}

export async function saveMilestone(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId")), id = Number(fd.get("id"));
  const data = { title: title.parse(fd.get("title")), dueDate: parseDay(String(fd.get("dueDate"))) };
  if (id) await db.milestone.update({ where: { id }, data });
  else await db.milestone.create({ data: { ...data, eventId, sort: await db.milestone.count({ where: { eventId } }) } });
  await logActivity(eventId, `Meilenstein „${data.title}“ ${id ? "geändert" : "angelegt"}`);
  refresh(eventId);
}
export async function deleteMilestone(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  await db.milestone.delete({ where: { id: Number(fd.get("id")) } });
  refresh(eventId);
}

export async function saveTask(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId")), id = Number(fd.get("id"));
  const data = {
    title: title.parse(fd.get("title")), description: opt(fd.get("description")),
    dueDate: parseDay(String(fd.get("dueDate"))),
    status: z.enum(TASK_STATUS).default("OFFEN").parse(fd.get("status") || undefined),
    assigneeId: Number(fd.get("assigneeId")) || null, milestoneId: Number(fd.get("milestoneId")) || null,
  };
  const before = id ? await db.task.findUnique({ where: { id } }) : null;
  if (id) await db.task.update({ where: { id }, data });
  else await db.task.create({ data: { ...data, eventId, sort: await db.task.count({ where: { eventId } }) } });
  await logActivity(eventId, `Aufgabe „${data.title}“ ${id ? "geändert" : "angelegt"}`);
  if (data.assigneeId && data.assigneeId !== before?.assigneeId) {
    await sendPush({ title: "Neue Aufgabe für dich", body: `${data.title} (fällig ${data.dueDate.toISOString().slice(0, 10).split("-").reverse().join(".")})`, url: "/meine-aufgaben" }, [data.assigneeId]).catch(() => {});
  }
  revalidatePath("/meine-aufgaben");
  refresh(eventId);
}

export async function cycleTaskStatus(fd: FormData) {
  const me = await requireUser();
  const id = Number(fd.get("id"));
  const t = await db.task.findUniqueOrThrow({ where: { id } });
  if (!hasRole(me, "ORGANISATOR") && t.assigneeId !== me.id) throw new Error("Keine Berechtigung");
  const next = TASK_STATUS[(TASK_STATUS.indexOf(t.status as TaskStatus) + 1) % TASK_STATUS.length];
  await db.task.update({ where: { id }, data: { status: next } });
  await logActivity(t.eventId, `„${t.title}“ → ${TASK_LABEL[next]} (${me.name})`);
  refresh(t.eventId);
  revalidatePath("/meine-aufgaben");
}

export async function deleteTask(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  await db.task.delete({ where: { id: Number(fd.get("id")) } });
  refresh(eventId);
}

export async function saveAsTemplate(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  const existing = Number(fd.get("templateId"));
  const newName = opt(fd.get("newName"));
  const tid = await saveEventAsTemplate(eventId, existing ? { templateId: existing } : { newName: z.string().min(1).parse(newName) });
  redirect(`/vorlagen/${tid}`);
}

const slotSchema = z.object({ title, timeText: z.string().trim().max(100).optional(), description: z.string().trim().max(500).optional(), capacity: z.coerce.number().int().min(1).max(500) });
export async function saveSlot(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId")), id = Number(fd.get("id"));
  const p = slotSchema.parse(Object.fromEntries(fd));
  const data = { title: p.title, timeText: p.timeText || null, description: p.description || null, capacity: p.capacity };
  if (id) await db.helperSlot.update({ where: { id }, data }); else await db.helperSlot.create({ data: { ...data, eventId } });
  await logActivity(eventId, `Helfer-Slot „${p.title}“ ${id ? "geändert" : "angelegt"}`);
  refresh(eventId);
}
export async function deleteSlot(fd: FormData) {
  await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  await db.helperSlot.delete({ where: { id: Number(fd.get("id")) } });
  refresh(eventId);
}
