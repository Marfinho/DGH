"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hasRole, rateLimit } from "@/lib/auth";
import { BOARD_CATEGORIES, KINDS, defaultDays } from "@/lib/board";
import { storePhoto, PhotoError } from "@/lib/photos";
import { removePhotosOf } from "@/lib/photos-db";

const refresh = () => { revalidatePath("/brett"); revalidatePath("/fundbuero"); revalidatePath("/"); };

export async function createPost(fd: FormData) {
  const me = await requireUser();
  const d = z.object({
    category: z.enum(BOARD_CATEGORIES), kind: z.enum(KINDS), title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(2000),
    contact: z.string().trim().max(200).optional(), days: z.coerce.number().int().min(1).max(120).optional(),
  }).parse(Object.fromEntries(fd));
  const back = d.category === "FUNDBUERO" ? "/fundbuero" : "/brett";
  if (!rateLimit(`post:${me.id}`, 10, 24 * 3600_000)) redirect(`${back}?fehler=${encodeURIComponent("Heute sind es genug Beiträge – bitte morgen wieder.")}`);
  let stored: string | null = null;
  try { stored = await storePhoto(fd.get("photo") as File | null); }
  catch (e) { if (e instanceof PhotoError) redirect(`${back}?fehler=${encodeURIComponent(e.message)}`); throw e; }
  await db.boardPost.create({ data: {
    authorId: me.id, category: d.category, kind: d.kind, title: d.title, body: d.body, contact: d.contact || null,
    expiresAt: new Date(Date.now() + (d.days ?? defaultDays(d.category)) * 86_400_000),
    photos: stored ? { create: { storedName: stored } } : undefined,
  } });
  refresh();
}

async function ownOrOrga(id: number) {
  const me = await requireUser();
  const post = await db.boardPost.findUniqueOrThrow({ where: { id } });
  if (post.authorId !== me.id && !hasRole(me, "ORGANISATOR")) throw new Error("Keine Berechtigung");
  return { me, post };
}

export async function toggleDone(fd: FormData) {
  const { post } = await ownOrOrga(Number(fd.get("id")));
  await db.boardPost.update({ where: { id: post.id }, data: { status: post.status === "OFFEN" ? "ERLEDIGT" : "OFFEN" } });
  refresh();
}
export async function renewPost(fd: FormData) {
  const { post } = await ownOrOrga(Number(fd.get("id")));
  await db.boardPost.update({ where: { id: post.id }, data: { expiresAt: new Date(Date.now() + defaultDays(post.category) * 86_400_000), status: "OFFEN" } });
  refresh();
}
export async function deletePost(fd: FormData) {
  const { post } = await ownOrOrga(Number(fd.get("id")));
  await removePhotosOf({ postId: post.id });
  await db.boardPost.delete({ where: { id: post.id } });
  refresh();
}
export async function reportPost(fd: FormData) {
  await requireUser();
  await db.boardPost.update({ where: { id: Number(fd.get("id")) }, data: { reportedAt: new Date() } });
  refresh();
}
export async function dismissReport(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.boardPost.update({ where: { id: Number(fd.get("id")) }, data: { reportedAt: null } });
  refresh();
}
