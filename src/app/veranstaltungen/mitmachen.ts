"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";

async function visibleEvent(eventId: number, me: { role: string }) {
  const ev = await db.event.findUnique({ where: { id: eventId } });
  if (!ev || (!ev.published && !hasRole(me, "ORGANISATOR"))) throw new Error("Veranstaltung nicht gefunden");
  return ev;
}

export async function setRsvp(fd: FormData) {
  const me = await requireUser();
  const eventId = Number(fd.get("eventId"));
  await visibleEvent(eventId, me);
  const status = z.enum(["JA", "NEIN", "VIELLEICHT"]).parse(fd.get("status"));
  const guests = z.coerce.number().int().min(0).max(20).parse(fd.get("guests") || 0);
  await db.rsvp.upsert({
    where: { eventId_personId: { eventId, personId: me.id } },
    update: { status, guests: status === "NEIN" ? 0 : guests }, create: { eventId, personId: me.id, status, guests: status === "NEIN" ? 0 : guests },
  });
  revalidatePath(`/veranstaltungen/${eventId}`);
}

export async function joinSlot(fd: FormData) {
  const me = await requireUser();
  const slotId = Number(fd.get("slotId"));
  const slot = await db.helperSlot.findUniqueOrThrow({ where: { id: slotId } });
  await visibleEvent(slot.eventId, me);
  // Kapazität in einer Transaktion prüfen (SQLite serialisiert Schreibzugriffe)
  await db.$transaction(async (tx) => {
    const n = await tx.helperSignup.count({ where: { slotId } });
    if (n >= slot.capacity) throw new Error("Dieser Slot ist leider schon voll.");
    await tx.helperSignup.upsert({ where: { slotId_personId: { slotId, personId: me.id } }, update: {}, create: { slotId, personId: me.id } });
  });
  revalidatePath(`/veranstaltungen/${slot.eventId}`);
}

export async function leaveSlot(fd: FormData) {
  const me = await requireUser();
  const slotId = Number(fd.get("slotId"));
  const slot = await db.helperSlot.findUniqueOrThrow({ where: { id: slotId } });
  await db.helperSignup.deleteMany({ where: { slotId, personId: me.id } });
  revalidatePath(`/veranstaltungen/${slot.eventId}`);
}
