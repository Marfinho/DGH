"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const off = z.coerce.number().int().min(-1000).max(1000);

export async function createTemplate(fd: FormData) {
  const name = z.string().trim().min(1).max(100).parse(fd.get("name"));
  const t = await db.template.create({ data: { name } });
  redirect(`/vorlagen/${t.id}`);
}
export async function updateTemplate(fd: FormData) {
  const id = Number(fd.get("id"));
  await db.template.update({ where: { id }, data: { name: z.string().trim().min(1).max(100).parse(fd.get("name")), description: String(fd.get("description") ?? "").trim() || null } });
  revalidatePath(`/vorlagen/${id}`);
}
export async function deleteTemplate(fd: FormData) {
  await db.template.delete({ where: { id: Number(fd.get("id")) } });
  redirect("/vorlagen");
}
export async function saveTplMilestone(fd: FormData) {
  const templateId = Number(fd.get("templateId")), id = Number(fd.get("id"));
  const data = { title: z.string().trim().min(1).max(200).parse(fd.get("title")), offsetDays: off.parse(fd.get("offsetDays")) };
  if (id) await db.templateMilestone.update({ where: { id }, data });
  else await db.templateMilestone.create({ data: { ...data, templateId, sort: (await db.templateMilestone.count({ where: { templateId } })) } });
  revalidatePath(`/vorlagen/${templateId}`);
}
export async function deleteTplMilestone(fd: FormData) {
  await db.templateMilestone.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}
export async function saveTplTask(fd: FormData) {
  const templateId = Number(fd.get("templateId")), id = Number(fd.get("id"));
  const ms = Number(fd.get("milestoneId"));
  const data = {
    title: z.string().trim().min(1).max(200).parse(fd.get("title")),
    description: String(fd.get("description") ?? "").trim() || null,
    offsetDays: off.parse(fd.get("offsetDays")),
    milestoneId: ms || null,
  };
  if (id) await db.templateTask.update({ where: { id }, data });
  else await db.templateTask.create({ data: { ...data, templateId, sort: await db.templateTask.count({ where: { templateId } }) } });
  revalidatePath(`/vorlagen/${templateId}`);
}
export async function deleteTplTask(fd: FormData) {
  await db.templateTask.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}
