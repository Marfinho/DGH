"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(1).max(100), email: z.string().trim().max(200).optional(), phone: z.string().trim().max(50).optional() });
const clean = (v?: string) => v || null;

export async function savePerson(fd: FormData) {
  const p = schema.parse(Object.fromEntries(fd));
  const id = Number(fd.get("id"));
  const data = { name: p.name, email: clean(p.email), phone: clean(p.phone) };
  if (id) await db.person.update({ where: { id }, data }); else await db.person.create({ data });
  revalidatePath("/", "layout");
}
export async function deletePerson(fd: FormData) {
  await db.person.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath("/", "layout");
}
