"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, rateLimit, appUrl } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { buildIcs } from "@/lib/ical";
import { parseDay, today } from "@/lib/dates";
import { parseTime } from "@/lib/plan";
import { parseAgenda, invitationMail, RESPONSES } from "@/lib/meetings";
import { protocolInclude, protocolFromDb } from "@/lib/meetings-db";

const ORGA_ROLES = ["ORGANISATOR", "ADMIN"];
const base = (id: number) => `/versammlungen/${id}`;
const back = (id: number, q: Record<string, string>) => redirect(`${base(id)}?${new URLSearchParams(q)}`);
const refresh = (id?: number) => { revalidatePath("/versammlungen"); if (id) revalidatePath(base(id)); revalidatePath("/planung"); };
const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max) || null; // nie werfen: Text geht nicht verloren
const orgaPeople = () => db.person.findMany({ where: { role: { in: ORGA_ROLES } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } });

async function loadOpen(id: number) {
  const m = await db.meeting.findUniqueOrThrow({ where: { id } });
  return m;
}

export async function createMeeting(fd: FormData) {
  await requireUser("ORGANISATOR");
  const title = clip(fd.get("title"), 120) ?? "Orga-Treffen";
  let date: Date, startTime: string | null, endTime: string | null;
  try { date = parseDay(String(fd.get("date"))); startTime = parseTime(String(fd.get("startTime") ?? "")); endTime = parseTime(String(fd.get("endTime") ?? "")); }
  catch (e) { redirect(`/versammlungen?fehler=${encodeURIComponent((e as Error).message)}`); }
  if (!startTime!) redirect(`/versammlungen?fehler=${encodeURIComponent("Bitte eine Uhrzeit angeben.")}`);
  const people = await orgaPeople();
  const m = await db.meeting.create({ data: {
    title, date: date!, startTime: startTime!, endTime: endTime! && endTime! > startTime! ? endTime! : null,
    location: clip(fd.get("location"), 200), invitationText: clip(fd.get("invitationText"), 2000),
    agenda: { create: parseAgenda(String(fd.get("agenda") ?? "")).map((t, i) => ({ title: t, sort: i })) },
    invitees: { create: people.map((p) => ({ personId: p.id, name: p.name })) },
  } });
  refresh();
  redirect(base(m.id));
}

export async function updateMeeting(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("id"));
  if ((await loadOpen(id)).finalizedAt) back(id, { fehler: "Das Protokoll ist abgeschlossen – zum Ändern erst wieder öffnen." });
  let date: Date, startTime: string | null, endTime: string | null;
  try { date = parseDay(String(fd.get("date"))); startTime = parseTime(String(fd.get("startTime") ?? "")); endTime = parseTime(String(fd.get("endTime") ?? "")); }
  catch (e) { back(id, { fehler: (e as Error).message }); }
  if (!startTime!) back(id, { fehler: "Bitte eine Uhrzeit angeben." });
  await db.meeting.update({ where: { id }, data: {
    title: clip(fd.get("title"), 120) ?? "Orga-Treffen", date: date!, startTime: startTime!, endTime: endTime! && endTime! > startTime! ? endTime! : null,
    location: clip(fd.get("location"), 200), invitationText: clip(fd.get("invitationText"), 2000),
  } });
  refresh(id);
}

export async function deleteMeeting(fd: FormData) {
  await requireUser("ORGANISATOR");
  await db.meeting.delete({ where: { id: Number(fd.get("id")) } });
  refresh();
  redirect("/versammlungen");
}

// ---------- Tagesordnung ----------
export async function addAgendaItems(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  const m = await loadOpen(id);
  if (m.finalizedAt) back(id, { fehler: "Das Protokoll ist abgeschlossen." });
  const n = await db.meetingAgendaItem.count({ where: { meetingId: id } });
  const items = parseAgenda(String(fd.get("titles") ?? ""));
  await db.meetingAgendaItem.createMany({ data: items.map((title, i) => ({ meetingId: id, title, sort: n + i })) });
  refresh(id);
}
export async function deleteAgendaItem(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  const m = await loadOpen(id);
  if (m.finalizedAt) back(id, { fehler: "Das Protokoll ist abgeschlossen." });
  await db.meetingAgendaItem.delete({ where: { id: Number(fd.get("id")), meetingId: id } });
  refresh(id);
}
export async function moveAgendaItem(dir: "up" | "down", fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  const items = await db.meetingAgendaItem.findMany({ where: { meetingId: id }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  const i = items.findIndex((x) => x.id === Number(fd.get("id"))), j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await db.$transaction(items.map((x, k) => db.meetingAgendaItem.update({ where: { id: x.id }, data: { sort: k } })));
  refresh(id);
}

// ---------- Einladung ----------
/** Eingeladene festlegen – nur Personen mit Orga-Rolle. */
export async function setInvitees(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  if ((await loadOpen(id)).finalizedAt) back(id, { fehler: "Das Protokoll ist abgeschlossen – zum Ändern erst wieder öffnen." });
  const people = await orgaPeople();
  const allowed = new Map(people.map((p) => [p.id, p]));
  const chosen = new Set(fd.getAll("personId").map(Number).filter((n) => allowed.has(n)));
  const current = await db.meetingInvitee.findMany({ where: { meetingId: id } });
  await db.$transaction([
    db.meetingInvitee.deleteMany({ where: { meetingId: id, personId: { notIn: [...chosen] }, present: false } }),
    ...[...chosen].filter((pid) => !current.some((c) => c.personId === pid)).map((pid) => db.meetingInvitee.create({ data: { meetingId: id, personId: pid, name: allowed.get(pid)!.name } })),
  ]);
  refresh(id);
}

/** Einladung per Mail (+ .ics) und Push. mode "neu": nur noch nicht Eingeladene; "alle": alle erneut (als Aktualisierung). */
export async function sendInvitations(mode: "neu" | "alle", fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  if (!rateLimit(`invite:${me.id}`, 10, 3600_000)) back(id, { fehler: "Zu viele Versandversuche – bitte später erneut." });
  const m = await db.meeting.findUniqueOrThrow({ where: { id }, include: { agenda: { orderBy: [{ sort: "asc" }, { id: "asc" }] }, invitees: { include: { person: { select: { id: true, email: true, role: true } } } } } });
  const targets = m.invitees.filter((i) => i.person && ORGA_ROLES.includes(i.person.role) && (mode === "alle" || !i.invitedAt));
  const ics = buildIcs(m.title, [{ uid: `meeting-${m.id}`, title: m.title, date: m.date, startTime: m.startTime, endTime: m.endTime, location: m.location, description: m.agenda.map((a, k) => `${k + 1}. ${a.title}`).join("\n") }]);
  const agenda = m.agenda.map((a) => a.title);
  const count = { GESENDET: 0, KEINE_ADRESSE: 0, FEHLER: 0, NICHT_KONFIGURIERT: 0 };
  for (const inv of targets) {
    let status: keyof typeof count;
    if (!inv.person!.email) status = "KEINE_ADRESSE";
    else {
      const mail = invitationMail(m, agenda, inv.name, `${appUrl()}${base(m.id)}`, mode === "alle" && inv.mailStatus === "GESENDET");
      try { status = (await sendMail(inv.person!.email, mail.subject, mail.text, { attachments: [{ filename: "versammlung.ics", content: ics, contentType: "text/calendar; charset=utf-8" }], logIfUnconfigured: false })) ? "GESENDET" : "NICHT_KONFIGURIERT"; }
      catch (e) { console.error(`Einladung an Person ${inv.personId} fehlgeschlagen:`, (e as Error).message); status = "FEHLER"; }
    }
    count[status]++;
    await db.meetingInvitee.update({ where: { id: inv.id }, data: { invitedAt: new Date(), mailStatus: status } });
  }
  const pushIds = targets.map((t) => t.personId!).filter((pid) => pid !== me.id);
  if (pushIds.length) await sendPush({ title: `Einladung: ${m.title}`, body: `${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(m.date)}, ${m.startTime} Uhr${m.location ? ` · ${m.location}` : ""}`, url: base(m.id) }, pushIds).catch(() => {});
  refresh(id);
  back(id, { versand: `${count.GESENDET},${count.KEINE_ADRESSE},${count.FEHLER},${count.NICHT_KONFIGURIERT}`, art: "einladung" });
}

export async function respond(response: string, fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  const r = z.enum(RESPONSES).parse(response);
  await db.meetingInvitee.upsert({ where: { meetingId_personId: { meetingId: id, personId: me.id } }, update: { response: r }, create: { meetingId: id, personId: me.id, name: me.name, response: r } });
  refresh(id);
}

// ---------- Protokoll ----------
/** Speichert das ganze Protokoll in einem Rutsch (+ optional neues To-do). Wirft bei Eingaben nie – zu lange Texte werden gekürzt. */
async function persistProtocol(id: number, fd: FormData) {
  const m = await db.meeting.findUniqueOrThrow({ where: { id }, include: { agenda: true, invitees: true } });
  if (m.finalizedAt) back(id, { fehler: "Das Protokoll ist abgeschlossen – zum Ändern erst wieder öffnen." });
  // Gleichzeitiges Bearbeiten: nur Felder übernehmen, die diese Person geändert hat (orig_* = Stand beim Laden).
  // So überschreibt ein älteres Formular nicht, was jemand anderes inzwischen gespeichert hat – und eigener Text geht nie verloren.
  const pick = (name: string, current: string | null, max: number) => {
    const orig = fd.get(`orig_${name}`);
    if (orig !== null && String(fd.get(name) ?? "").trim() === String(orig).trim()) return current;
    return clip(fd.get(name), max);
  };
  const present = new Set(fd.getAll("present").map(Number)), wasPresent = new Set(fd.getAll("orig_present").map(Number));
  const hasOrig = fd.has("orig_loaded");
  await db.$transaction([
    db.meeting.update({ where: { id }, data: { chair: pick("chair", m.chair, 120), minuteTaker: pick("minuteTaker", m.minuteTaker, 120), guests: pick("guests", m.guests, 500), generalNotes: pick("generalNotes", m.generalNotes, 10000) } }),
    ...m.agenda.map((a) => db.meetingAgendaItem.update({ where: { id: a.id }, data: { notes: pick(`notes_${a.id}`, a.notes, 10000), decision: pick(`decision_${a.id}`, a.decision, 2000) } })),
    ...m.invitees.map((i) => db.meetingInvitee.update({ where: { id: i.id }, data: { present: hasOrig && present.has(i.id) === wasPresent.has(i.id) ? i.present : present.has(i.id) } })),
  ]);
  // neues To-do aus dem Formular
  const title = clip(fd.get("todoTitle"), 200);
  if (title) {
    let due: Date | null = null;
    try { const raw = String(fd.get("todoDue") ?? ""); if (raw) due = parseDay(raw); } catch { /* ungültiges Datum: ohne Frist anlegen */ }
    const assigneeId = Number(fd.get("todoAssignee")) || null;
    const agendaItemId = Number(fd.get("todoAgenda")) || null;
    await db.meetingTodo.create({ data: { meetingId: id, title, assigneeId, dueDate: due, agendaItemId: m.agenda.some((a) => a.id === agendaItemId) ? agendaItemId : null } });
    if (assigneeId) await sendPush({ title: "Neues To-do aus der Versammlung", body: `${title} (${m.title})`, url: "/meine-aufgaben" }, [assigneeId]).catch(() => {});
  }
}

export async function saveProtocol(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  await persistProtocol(id, fd);
  refresh(id);
  back(id, { gespeichert: "1" });
}

/** Aus dem Protokollformular heraus: erst alles speichern, dann To-do umschalten/löschen – so geht kein getippter Text verloren. */
export async function saveAndTodo(action: "toggle" | "delete", todoId: number, fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  await persistProtocol(id, fd);
  const t = await db.meetingTodo.findUniqueOrThrow({ where: { id: todoId, meetingId: id } });
  if (action === "toggle") await db.meetingTodo.update({ where: { id: t.id }, data: { done: !t.done } });
  else await db.meetingTodo.delete({ where: { id: t.id } });
  refresh(id);
  back(id, { gespeichert: "1" });
}

export async function addTodo(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  const title = clip(fd.get("title"), 200);
  if (!title) back(id, { fehler: "Bitte das To-do beschreiben." });
  let due: Date | null = null;
  const raw = String(fd.get("dueDate") ?? "");
  if (raw) { try { due = parseDay(raw); } catch { back(id, { fehler: "Ungültiges Datum beim To-do." }); } }
  const assigneeId = Number(fd.get("assigneeId")) || null;
  const agendaItemId = Number(fd.get("agendaItemId")) || null;
  const m = await db.meeting.findUniqueOrThrow({ where: { id } });
  await db.meetingTodo.create({ data: { meetingId: id, title: title!, assigneeId, dueDate: due, agendaItemId } });
  if (assigneeId) await sendPush({ title: "Neues To-do aus der Versammlung", body: `${title} (${m.title})`, url: "/meine-aufgaben" }, [assigneeId]).catch(() => {});
  refresh(id);
}
export async function toggleTodo(fd: FormData) {
  const me = await requireUser();
  const t = await db.meetingTodo.findUniqueOrThrow({ where: { id: Number(fd.get("id")) } });
  // Erledigen dürfen Orga und die zuständige Person
  if (t.assigneeId !== me.id && !ORGA_ROLES.includes(me.role)) throw new Error("Keine Berechtigung");
  await db.meetingTodo.update({ where: { id: t.id }, data: { done: !t.done } });
  refresh(t.meetingId); revalidatePath("/meine-aufgaben"); revalidatePath("/");
}
export async function deleteTodo(fd: FormData) {
  await requireUser("ORGANISATOR");
  const t = await db.meetingTodo.delete({ where: { id: Number(fd.get("id")) } });
  refresh(t.meetingId);
}

export async function saveAndFinalize(fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  await persistProtocol(id, fd);
  await db.meeting.update({ where: { id }, data: { finalizedAt: new Date() } });
  refresh(id);
  back(id, { abgeschlossen: "1" });
}

export async function finalizeProtocol(open: boolean, fd: FormData) {
  await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  await db.meeting.update({ where: { id }, data: { finalizedAt: open ? null : new Date() } });
  refresh(id);
}

/** Protokoll an alle Eingeladenen schicken (nur abgeschlossene Protokolle; Text wird nie ins Log geschrieben). */
export async function sendProtocol(fd: FormData) {
  const me = await requireUser("ORGANISATOR");
  const id = Number(fd.get("meetingId"));
  if (!rateLimit(`protocol:${me.id}`, 5, 3600_000)) back(id, { fehler: "Zu viele Versandversuche – bitte später erneut." });
  const m = await db.meeting.findUniqueOrThrow({ where: { id }, include: protocolInclude });
  if (!m.finalizedAt) back(id, { fehler: "Bitte das Protokoll zuerst abschließen." });
  const text = protocolFromDb(m);
  const count = { GESENDET: 0, KEINE_ADRESSE: 0, FEHLER: 0, NICHT_KONFIGURIERT: 0 };
  for (const inv of m.invitees) {
    if (!inv.person) continue;
    if (!inv.person.email) { count.KEINE_ADRESSE++; continue; }
    try { (await sendMail(inv.person.email, `Protokoll: ${m.title}`, `Hallo ${inv.name.split(" ")[0]},\n\nanbei das Protokoll.\n\n${text}\n\nOnline: ${appUrl()}${base(m.id)}`, { logIfUnconfigured: false })) ? count.GESENDET++ : count.NICHT_KONFIGURIERT++; }
    catch (e) { console.error(`Protokoll an Person ${inv.personId} fehlgeschlagen:`, (e as Error).message); count.FEHLER++; }
  }
  if (count.GESENDET) await db.meeting.update({ where: { id }, data: { protocolSentAt: new Date() } });
  refresh(id);
  back(id, { versand: `${count.GESENDET},${count.KEINE_ADRESSE},${count.FEHLER},${count.NICHT_KONFIGURIERT}`, art: "protokoll" });
}

