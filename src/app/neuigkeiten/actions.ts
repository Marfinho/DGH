"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";

export async function createNews(fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const d = z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(5000) }).parse(Object.fromEntries(fd));
  await db.newsPost.create({ data: { ...d, pinned: fd.get("pinned") === "on", authorId: me.id, groupId: Number(fd.get("groupId")) || null } });
  if (fd.get("push") === "on") await sendPush({ title: d.title, body: d.body.slice(0, 120), url: "/neuigkeiten" }).catch(() => {});
  revalidatePath("/", "layout");
}
export async function togglePin(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id")); const n = await db.newsPost.findUniqueOrThrow({ where: { id } });
  await db.newsPost.update({ where: { id }, data: { pinned: !n.pinned } });
  revalidatePath("/", "layout");
}
export async function deleteNews(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.newsPost.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/", "layout");
}
