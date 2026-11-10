"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageGroup } from "@/lib/group-access";
import { parseDay } from "@/lib/dates";

const o = (v: FormDataEntryValue | null, max = 500) => String(v ?? "").trim().slice(0, max) || null;
const refresh = (groupId: number) => { revalidatePath(`/gruppen/${groupId}`); revalidatePath("/veranstaltungen"); revalidatePath("/neuigkeiten"); revalidatePath("/"); };

async function manage(fd: FormData) {
  const me = await requireUser();
  const groupId = Number(fd.get("groupId"));
  if (!(await canManageGroup(groupId, me))) throw new Error("Keine Berechtigung");
  return { me, groupId };
}

/** Vereinstermin anlegen/ändern – ein einfacher Termin ohne Planungsapparat (Aufgaben/Budget bleiben bei der Orga). */
export async function saveGroupEvent(fd: FormData) {
  const { me, groupId } = await manage(fd);
  const id = Number(fd.get("id"));
  const data = {
    title: z.string().trim().min(1).max(200).parse(fd.get("title")), date: parseDay(String(fd.get("date"))),
    location: o(fd.get("location"), 200), description: o(fd.get("description"), 2000), published: fd.get("published") === "on",
  };
  if (id) {
    const ev = await db.event.findUniqueOrThrow({ where: { id } });
    if (ev.groupId !== groupId) throw new Error("Termin gehört nicht zu diesem Verein");
    await db.event.update({ where: { id }, data });
    await logActivity(id, `Termin vom Verein geändert (${me.name})`);
  } else {
    const ev = await db.event.create({ data: { ...data, groupId } });
    await logActivity(ev.id, `Vereinstermin angelegt (${me.name})`);
  }
  refresh(groupId);
}

export async function deleteGroupEvent(fd: FormData) {
  const { me, groupId } = await manage(fd);
  const ev = await db.event.findUniqueOrThrow({ where: { id: Number(fd.get("id")) }, include: { _count: { select: { tasks: true, budgetItems: true } } } });
  if (ev.groupId !== groupId) throw new Error("Termin gehört nicht zu diesem Verein");
  if ((me.role === "BEWOHNER") && (ev._count.tasks > 0 || ev._count.budgetItems > 0)) throw new Error("Dieser Termin wird von der Orga geplant und kann nur dort gelöscht werden.");
  await db.event.delete({ where: { id: ev.id } });
  refresh(groupId);
}

export async function saveGroupNews(fd: FormData) {
  const { me, groupId } = await manage(fd);
  const d = z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000) }).parse(Object.fromEntries(fd));
  await db.newsPost.create({ data: { ...d, groupId, authorId: me.id } });
  refresh(groupId);
}
export async function deleteGroupNews(fd: FormData) {
  const { groupId } = await manage(fd);
  const n = await db.newsPost.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
  if (n.groupId !== groupId) throw new Error("Beitrag gehört nicht zu diesem Verein");
  await db.newsPost.delete({ where: { id: n.id } });
  refresh(groupId);
}

export async function addVorstand(fd: FormData) {
  await requireUser("ORGANISATOR");
  const groupId = Number(fd.get("groupId")), personId = Number(fd.get("personId"));
  if (!personId) return;
  await db.groupMember.upsert({ where: { groupId_personId: { groupId, personId } }, update: {}, create: { groupId, personId, role: "VORSTAND" } });
  refresh(groupId);
}
export async function removeVorstand(fd: FormData) {
  await requireUser("ORGANISATOR");
  const groupId = Number(fd.get("groupId"));
  await db.groupMember.deleteMany({ where: { groupId, personId: Number(fd.get("personId")) } });
  refresh(groupId);
}
