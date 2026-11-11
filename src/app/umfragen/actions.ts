"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { parseDay, today } from "@/lib/dates";
import { isOpen, validateChoice, parseOptions } from "@/lib/polls";

const refresh = () => { revalidatePath("/umfragen"); revalidatePath("/"); };
const fail = (msg: string, at = "/umfragen"): never => redirect(`${at}?fehler=${encodeURIComponent(msg)}`);

export async function createPoll(fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const d = z.object({
    title: z.string().trim().min(3).max(200), description: z.string().trim().max(2000).optional(),
    options: z.string().max(5000), closesOn: z.string().optional(),
  }).parse(Object.fromEntries(fd));
  const options = parseOptions(d.options);
  if (options.length < 2) fail("Bitte mindestens zwei Antworten angeben (eine pro Zeile).");
  if (options.length > 20) fail("Höchstens 20 Antworten.");
  let closesOn: Date | null = null;
  if (d.closesOn) {
    try { closesOn = parseDay(d.closesOn); } catch { fail("Ungültiges Datum."); }
    if (closesOn! < today()) fail("Der letzte Abstimmungstag liegt in der Vergangenheit.");
  }
  const poll = await db.poll.create({ data: {
    title: d.title, description: d.description || null, multiple: fd.get("multiple") === "on", closesOn, createdById: me.id,
    options: { create: options.map((text, sort) => ({ text, sort })) },
  } });
  if (fd.get("push") === "on") await sendPush({ title: `Umfrage: ${poll.title}`, body: "Stimm jetzt ab!", url: `/umfragen#u${poll.id}` }).catch(() => {});
  refresh();
  redirect(`/umfragen#u${poll.id}`);
}

/** Ersetzt die eigenen Stimmen einer Umfrage (Ändern bis zum Ende möglich). */
export async function vote(fd: FormData) {
  const me = await requireUser();
  const pollId = Number(fd.get("pollId"));
  if (!rateLimit(`vote:${me.id}`, 60)) fail("Zu viele Versuche – bitte kurz warten.");
  const poll = await db.poll.findUniqueOrThrow({ where: { id: pollId }, include: { options: { select: { id: true } } } });
  if (!isOpen(poll, today())) fail("Diese Umfrage ist bereits beendet.");
  let ids: number[] = [];
  try { ids = validateChoice(poll.multiple, fd.getAll("optionId").map(Number), poll.options.map((o) => o.id)); }
  catch (e) { fail((e as Error).message); }
  await db.$transaction([
    db.pollVote.deleteMany({ where: { pollId, personId: me.id } }),
    db.pollVote.createMany({ data: ids.map((optionId) => ({ pollId, optionId, personId: me.id })) }),
  ]);
  refresh();
  redirect(`/umfragen#u${pollId}`);
}

export async function withdrawVote(fd: FormData) {
  const me = await requireUser();
  const pollId = Number(fd.get("pollId"));
  const poll = await db.poll.findUniqueOrThrow({ where: { id: pollId } });
  if (!isOpen(poll, today())) fail("Diese Umfrage ist bereits beendet.");
  await db.pollVote.deleteMany({ where: { pollId, personId: me.id } });
  refresh();
}

export async function closePoll(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  const p = await db.poll.findUniqueOrThrow({ where: { id } });
  // Offen → beenden; beendet (manuell oder Frist abgelaufen) → wieder öffnen, abgelaufene Frist entfällt
  if (isOpen(p, today())) await db.poll.update({ where: { id }, data: { closedAt: new Date() } });
  else await db.poll.update({ where: { id }, data: { closedAt: null, ...(p.closesOn && p.closesOn < today() ? { closesOn: null } : {}) } });
  refresh();
}

export async function deletePoll(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.poll.delete({ where: { id: Number(fd.get("id")) } });
  refresh();
}
