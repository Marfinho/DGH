"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, newToken, endSession } from "@/lib/auth";

export async function saveProfile(fd: FormData) {
  const me = await requireUser();
  const p = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().max(200).optional(), phone: z.string().trim().max(50).optional() }).parse(Object.fromEntries(fd));
  const email = p.email || null;
  if (email) { const dup = await db.person.findUnique({ where: { email } }); if (dup && dup.id !== me.id) throw new Error("Diese E-Mail-Adresse ist schon vergeben."); }
  await db.person.update({ where: { id: me.id }, data: { name: p.name, email, phone: p.phone || null } });
  revalidatePath("/", "layout");
}

export async function renewCalendarToken() {
  const me = await requireUser();
  await db.person.update({ where: { id: me.id }, data: { calToken: newToken().slice(0, 32) } });
  revalidatePath("/profil");
}

export async function deleteOwnAccount() {
  const me = await requireUser();
  if (me.role === "ADMIN" && (await db.person.count({ where: { role: "ADMIN" } })) <= 1) throw new Error("Du bist der letzte Admin und kannst dein Konto nicht löschen.");
  await db.person.delete({ where: { id: me.id } });
  await endSession();
  redirect("/login");
}
