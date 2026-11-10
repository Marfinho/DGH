"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, ROLES, sha256, newInviteCode } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  role: z.enum(ROLES).default("BEWOHNER"),
});
const clean = (v?: string) => v || null;

export async function savePerson(fd: FormData) {
  const me = await requireUser("ADMIN");
  const p = schema.parse(Object.fromEntries(fd));
  const id = Number(fd.get("id"));
  const data = { name: p.name, email: clean(p.email), phone: clean(p.phone), role: p.role };
  if (id && id === me.id && p.role !== "ADMIN") throw new Error("Du kannst dir die Admin-Rolle nicht selbst entziehen.");
  if (data.email) {
    const dup = await db.person.findUnique({ where: { email: data.email } });
    if (dup && dup.id !== id) throw new Error("Diese E-Mail-Adresse ist schon vergeben.");
  }
  if (id) await db.person.update({ where: { id }, data }); else await db.person.create({ data });
  revalidatePath("/", "layout");
}

export async function deletePerson(fd: FormData) {
  const me = await requireUser("ADMIN");
  const id = Number(fd.get("id"));
  if (id === me.id) throw new Error("Du kannst dich nicht selbst löschen.");
  await db.person.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function createInvite(_: unknown, fd: FormData): Promise<{ code?: string }> {
  await requireUser("ADMIN");
  const personId = Number(fd.get("id"));
  const code = newInviteCode();
  await db.invite.create({ data: { personId, codeHash: sha256(code), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
  return { code };
}

export async function revokeSessions(fd: FormData) {
  await requireUser("ADMIN");
  await db.session.deleteMany({ where: { personId: Number(fd.get("id")) } });
  revalidatePath("/personen");
}
