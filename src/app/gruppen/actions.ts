"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const o = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const name = z.string().trim().min(1).max(150);
const url = (v: string | null) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v);

export async function saveGroup(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  const data = { name: name.parse(fd.get("name")), description: o(fd.get("description")), meetingInfo: o(fd.get("meetingInfo")), website: url(o(fd.get("website"))) };
  if (id) await db.group.update({ where: { id }, data }); else await db.group.create({ data });
  revalidatePath("/gruppen");
}
export async function deleteGroup(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.group.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/gruppen");
}
export async function saveContact(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  const data = { name: name.parse(fd.get("name")), function: o(fd.get("function")), phone: o(fd.get("phone")), email: o(fd.get("email")), groupId: Number(fd.get("groupId")) || null };
  if (id) await db.contact.update({ where: { id }, data }); else await db.contact.create({ data });
  revalidatePath("/gruppen");
}
export async function deleteContact(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.contact.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/gruppen");
}
