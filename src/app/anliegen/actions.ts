"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hasRole, rateLimit } from "@/lib/auth";
import { ISSUE_CATEGORIES, ISSUE_STATUS, ISSUE_STATUS_LABEL } from "@/lib/issues";
import { storePhoto, PhotoError } from "@/lib/photos";
import { removePhotosOf } from "@/lib/photos-db";
import { sendPush } from "@/lib/push";

const num = (v: FormDataEntryValue | null) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : null; };

export async function createIssue(fd: FormData) {
  const me = await requireUser();
  const d = z.object({ category: z.enum(ISSUE_CATEGORIES), title: z.string().trim().min(3).max(120), description: z.string().trim().min(3).max(3000), locationText: z.string().trim().max(200).optional() }).parse(Object.fromEntries(fd));
  if (!rateLimit(`issue:${me.id}`, 10, 24 * 3600_000)) redirect(`/anliegen?fehler=${encodeURIComponent("Heute sind es genug Meldungen – bitte morgen wieder.")}`);
  let stored: string | null = null;
  try { stored = await storePhoto(fd.get("photo") as File | null); }
  catch (e) { if (e instanceof PhotoError) redirect(`/anliegen?fehler=${encodeURIComponent(e.message)}`); throw e; }
  let lat = num(fd.get("lat")), lng = num(fd.get("lng"));
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) { lat = null; lng = null; }
  const issue = await db.issue.create({ data: { authorId: me.id, category: d.category, title: d.title, description: d.description, locationText: d.locationText || null, lat, lng, isPublic: fd.get("isPublic") === "on", photos: stored ? { create: { storedName: stored } } : undefined } });
  const staff = await db.person.findMany({ where: { role: { in: ["ORGANISATOR", "ADMIN"] } }, select: { id: true } });
  await sendPush({ title: "Neues Anliegen", body: d.title, url: `/anliegen/${issue.id}` }, staff.map((s) => s.id).filter((id) => id !== me.id)).catch(() => {});
  revalidatePath("/anliegen");
  redirect(`/anliegen/${issue.id}?neu=1`);
}

export async function updateIssue(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  const old = await db.issue.findUniqueOrThrow({ where: { id } });
  const status = z.enum(ISSUE_STATUS).parse(fd.get("status"));
  const response = String(fd.get("response") ?? "").trim().slice(0, 2000) || null;
  await db.issue.update({ where: { id }, data: { status, response, isPublic: fd.get("isPublic") === "on", forwardedAt: status === "WEITERGELEITET" && !old.forwardedAt ? new Date() : old.forwardedAt } });
  if (status !== old.status || response !== old.response) await sendPush({ title: `Anliegen: ${ISSUE_STATUS_LABEL[status]}`, body: response ? response.slice(0, 100) : old.title, url: `/anliegen/${id}` }, [old.authorId]).catch(() => {});
  revalidatePath(`/anliegen/${id}`); revalidatePath("/anliegen");
}

export async function deleteIssue(fd: FormData) {
  const me = await requireUser();
  const issue = await db.issue.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
  if (!hasRole(me, "ORGANISATOR") && !(issue.authorId === me.id && issue.status === "NEU")) throw new Error("Keine Berechtigung");
  await removePhotosOf({ issueId: issue.id });
  await db.issue.delete({ where: { id: issue.id } });
  revalidatePath("/anliegen");
  redirect("/anliegen");
}
