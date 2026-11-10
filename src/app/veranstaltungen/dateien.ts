"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, logActivity } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { storeUpload, removeStored, UploadError } from "@/lib/files";

export async function uploadFile(fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const eventId = Number(fd.get("eventId"));
  const budgetItemId = Number(fd.get("budgetItemId")) || null;
  const back = budgetItemId ? `/veranstaltungen/${eventId}/budget` : `/veranstaltungen/${eventId}`;
  if (budgetItemId && (await db.budgetItem.count({ where: { id: budgetItemId, eventId } })) === 0) throw new Error("Posten gehört zu einer anderen Veranstaltung");
  let stored;
  try { stored = await storeUpload(fd.get("file") as File); }
  catch (e) { if (e instanceof UploadError) redirect(`${back}?datei=${encodeURIComponent(e.message)}`); throw e; }
  await db.attachment.create({ data: { eventId, budgetItemId, ...stored, visible: !budgetItemId && fd.get("visible") === "on", uploadedById: me.id } });
  await logActivity(eventId, `Datei „${stored.name}“ hochgeladen (${me.name})`);
  revalidatePath(back);
}

export async function deleteFile(fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const a = await db.attachment.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
  await db.attachment.delete({ where: { id: a.id } });
  await removeStored(a.storedName);
  await logActivity(a.eventId, `Datei „${a.name}“ gelöscht (${me.name})`);
  revalidatePath(`/veranstaltungen/${a.eventId}`); revalidatePath(`/veranstaltungen/${a.eventId}/budget`);
}

export async function toggleVisible(fd: FormData) {
  await requireUser("ORGANISATOR");
  const a = await db.attachment.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
  if (a.budgetItemId) throw new Error("Belege sind nie für Bewohner sichtbar");
  await db.attachment.update({ where: { id: a.id }, data: { visible: !a.visible } });
  revalidatePath(`/veranstaltungen/${a.eventId}`);
}
