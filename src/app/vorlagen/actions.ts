"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { installStandardTemplates, STANDARD_TEMPLATES } from "@/lib/standard-templates";

const off = z.coerce.number().int().min(-1000).max(1000);

export async function createTemplate(fd: FormData) {
  await requireUser("ORGANISATOR");
  const name = z.string().trim().min(1).max(100).parse(fd.get("name"));
  const t = await db.template.create({ data: { name } });
  redirect(`/vorlagen/${t.id}`);
}
export async function updateTemplate(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  await db.template.update({ where: { id }, data: { name: z.string().trim().min(1).max(100).parse(fd.get("name")), description: String(fd.get("description") ?? "").trim() || null } });
  revalidatePath(`/vorlagen/${id}`);
}
export async function deleteTemplate(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.template.delete({ where: { id: Number(fd.get("id")) } });
  redirect("/vorlagen");
}
export async function saveTplMilestone(fd: FormData) {
  await requireUser("ORGANISATOR");
  const templateId = Number(fd.get("templateId")), id = Number(fd.get("id"));
  const data = { title: z.string().trim().min(1).max(200).parse(fd.get("title")), offsetDays: off.parse(fd.get("offsetDays")) };
  if (id) await db.templateMilestone.update({ where: { id }, data });
  else await db.templateMilestone.create({ data: { ...data, templateId, sort: (await db.templateMilestone.count({ where: { templateId } })) } });
  revalidatePath(`/vorlagen/${templateId}`);
}
export async function deleteTplMilestone(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.templateMilestone.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}
export async function saveTplTask(fd: FormData) {
  await requireUser("ORGANISATOR");
  const templateId = Number(fd.get("templateId")), id = Number(fd.get("id"));
  const ms = Number(fd.get("milestoneId"));
  const data = {
    title: z.string().trim().min(1).max(200).parse(fd.get("title")),
    description: String(fd.get("description") ?? "").trim() || null,
    offsetDays: off.parse(fd.get("offsetDays")),
    milestoneId: ms || null,
    areaId: Number(fd.get("areaId")) || null,
  };
  if (id) await db.templateTask.update({ where: { id }, data });
  else await db.templateTask.create({ data: { ...data, templateId, sort: await db.templateTask.count({ where: { templateId } }) } });
  revalidatePath(`/vorlagen/${templateId}`);
}
export async function deleteTplTask(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.templateTask.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}

export async function saveTplArea(fd: FormData) {
  await requireUser("ORGANISATOR");
  const templateId = Number(fd.get("templateId"));
  const name = z.string().trim().min(1).max(60).parse(fd.get("name"));
  await db.templateArea.upsert({ where: { templateId_name: { templateId, name } }, update: {}, create: { templateId, name, sort: await db.templateArea.count({ where: { templateId } }) } });
  revalidatePath(`/vorlagen/${templateId}`);
}
export async function deleteTplArea(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.templateArea.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}

/** Fertige Vorlagen (Osterfeuer, Dorfgemeinschaftsfest, Weihnachtsmarkt) anlegen – nur fehlende, vorhandene bleiben unverändert. */
export async function installStandard(fd: FormData) {
  await requireUser("ORGANISATOR");
  const wanted = fd.getAll("name").map(String).filter((n) => STANDARD_TEMPLATES.some((t) => t.name === n));
  const created = await db.$transaction((tx) => installStandardTemplates(tx, wanted.length ? wanted : undefined));
  revalidatePath("/vorlagen");
  redirect(`/vorlagen?neu=${encodeURIComponent(created.join(", "))}`);
}
export async function deleteTplSlot(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.templateSlot.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}
export async function deleteTplSchedule(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.templateScheduleItem.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}
export async function deleteTplMaterial(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.templateMaterialItem.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/vorlagen/${fd.get("templateId")}`);
}
