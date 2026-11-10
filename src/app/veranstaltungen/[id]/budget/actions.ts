"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { budgetAccess } from "@/lib/budget-access";
import { parseMoney, formatMoney } from "@/lib/money";
import { BUDGET_KIND, canPay } from "@/lib/budget";
import { sendPush } from "@/lib/push";

const refresh = (eventId: number) => { revalidatePath(`/veranstaltungen/${eventId}/budget`); revalidatePath(`/veranstaltungen/${eventId}`); revalidatePath("/"); };
const optText = (v: FormDataEntryValue | null, max = 300) => String(v ?? "").trim().slice(0, max) || null;
const money = (v: FormDataEntryValue | null) => parseMoney(String(v ?? ""));

async function manageAccess(fd: FormData) {
  const me = await requireUser();
  const eventId = Number(fd.get("eventId"));
  const acc = await budgetAccess(eventId, me);
  if (!acc.manage) throw new Error("Keine Berechtigung");
  return { me, eventId };
}
async function loadItem(id: number, eventId: number) {
  const item = await db.budgetItem.findUniqueOrThrow({ where: { id } });
  if (item.eventId !== eventId) throw new Error("Posten gehört zu einer anderen Veranstaltung");
  return item;
}

export async function saveBudgetSettings(fd: FormData) {
  const { eventId } = await manageAccess(fd);
  const limit = String(fd.get("budget") ?? "").trim();
  await db.event.update({ where: { id: eventId }, data: { budgetCents: limit ? money(limit) : null, approvalLimitCents: money(fd.get("approvalLimit") || "0") } });
  await logActivity(eventId, "Budgetrahmen geändert");
  refresh(eventId);
}

export async function saveItem(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const id = Number(fd.get("id"));
  const d = z.object({ kind: z.enum(BUDGET_KIND), title: z.string().trim().min(1).max(200) }).parse(Object.fromEntries(fd));
  const planned = money(fd.get("planned"));
  const areaId = Number(fd.get("areaId")) || null;
  if (areaId && (await db.area.count({ where: { id: areaId, eventId } })) === 0) throw new Error("Themengebiet gehört zu einer anderen Veranstaltung");
  const data = { kind: d.kind, title: d.title, areaId, category: optText(fd.get("category"), 60), note: optText(fd.get("note"), 500), plannedCents: planned };
  if (id) {
    const old = await loadItem(id, eventId);
    // Betrag oder Titel nach Beantragung/Freigabe geändert -> Freigabe wird zurückgesetzt
    const changed = old.plannedCents !== planned || old.title !== d.title;
    const reset = changed && (old.status === "BEANTRAGT" || old.status === "FREIGEGEBEN");
    await db.budgetItem.update({ where: { id }, data: { ...data, ...(reset ? { status: "ENTWURF", decidedById: null, decidedAt: null, decisionNote: null } : {}) } });
    await logActivity(eventId, `Budgetposten „${d.title}“ geändert (${me.name})${reset ? " – Freigabe zurückgesetzt" : ""}`);
  } else {
    await db.budgetItem.create({ data: { ...data, eventId } });
    await logActivity(eventId, `Budgetposten „${d.title}“ ${formatMoney(planned)} angelegt (${me.name})`);
  }
  refresh(eventId);
}

export async function deleteItem(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const item = await loadItem(Number(fd.get("id")), eventId);
  await db.budgetItem.delete({ where: { id: item.id } });
  await logActivity(eventId, `Budgetposten „${item.title}“ gelöscht (${me.name})`);
  refresh(eventId);
}

export async function submitItem(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const item = await loadItem(Number(fd.get("id")), eventId);
  if (item.kind !== "AUSGABE" || !["ENTWURF", "ABGELEHNT"].includes(item.status)) throw new Error("Dieser Posten kann nicht eingereicht werden");
  await db.budgetItem.update({ where: { id: item.id }, data: { status: "BEANTRAGT", requestedById: me.id, decidedById: null, decidedAt: null, decisionNote: null } });
  await logActivity(eventId, `Zur Freigabe eingereicht: „${item.title}“ ${formatMoney(item.plannedCents)} (${me.name})`);
  const approvers = await db.eventMember.findMany({ where: { eventId, role: "FREIGEBER", personId: { not: me.id } } });
  const ev = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  if (approvers.length) await sendPush({ title: `Freigabe: ${ev.title}`, body: `${item.title} · ${formatMoney(item.plannedCents)}`, url: `/veranstaltungen/${eventId}/budget` }, approvers.map((a) => a.personId)).catch(() => {});
  refresh(eventId);
}

/** Freigeber (pro Veranstaltung) oder Admin entscheidet – nie über die eigene Anfrage (Vier-Augen-Prinzip). */
export async function decideItem(rawDecision: string, fd: FormData) {
  const me = await requireUser();
  const eventId = Number(fd.get("eventId"));
  const acc = await budgetAccess(eventId, me);
  if (!acc.approve) throw new Error("Keine Berechtigung zur Freigabe");
  const item = await loadItem(Number(fd.get("id")), eventId);
  if (item.status !== "BEANTRAGT") throw new Error("Posten wartet nicht auf Freigabe");
  if (item.requestedById === me.id) throw new Error("Eigene Anfragen kann man nicht selbst freigeben");
  const decision = z.enum(["FREIGEGEBEN", "ABGELEHNT"]).parse(rawDecision);
  const note = optText(fd.get("note"), 300);
  if (decision === "ABGELEHNT" && !note) redirect(`/veranstaltungen/${eventId}/budget?fehler=begruendung`);
  await db.budgetItem.update({ where: { id: item.id }, data: { status: decision, decidedById: me.id, decidedAt: new Date(), decisionNote: note } });
  await logActivity(eventId, `„${item.title}“ ${decision === "FREIGEGEBEN" ? "freigegeben" : "abgelehnt"} von ${me.name}${note ? `: ${note}` : ""}`);
  if (item.requestedById) await sendPush({ title: decision === "FREIGEGEBEN" ? "Ausgabe freigegeben" : "Ausgabe abgelehnt", body: `${item.title}${note ? ` – ${note}` : ""}`, url: `/veranstaltungen/${eventId}/budget` }, [item.requestedById]).catch(() => {});
  refresh(eventId);
}

export async function markPaid(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const [item, ev] = await Promise.all([loadItem(Number(fd.get("id")), eventId), db.event.findUniqueOrThrow({ where: { id: eventId } })]);
  if (!canPay(item, ev.approvalLimitCents)) throw new Error("Für diese Ausgabe fehlt noch die Freigabe");
  const actual = money(fd.get("actual") || String(item.plannedCents / 100));
  await db.budgetItem.update({ where: { id: item.id }, data: { status: "BEZAHLT", actualCents: actual, paidAt: new Date() } });
  await logActivity(eventId, `${item.kind === "AUSGABE" ? "Bezahlt" : "Eingegangen"}: „${item.title}“ ${formatMoney(actual)} (${me.name})`);
  refresh(eventId);
}

export async function reopenItem(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const item = await loadItem(Number(fd.get("id")), eventId);
  await db.budgetItem.update({ where: { id: item.id }, data: { status: item.kind === "AUSGABE" ? "FREIGEGEBEN" : "ENTWURF", actualCents: null, paidAt: null } });
  await logActivity(eventId, `Zahlung zurückgenommen: „${item.title}“ (${me.name})`);
  refresh(eventId);
}

export async function addFreigeber(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const personId = Number(fd.get("personId"));
  if (!personId) return;
  await db.eventMember.upsert({ where: { eventId_personId_role: { eventId, personId, role: "FREIGEBER" } }, update: {}, create: { eventId, personId, role: "FREIGEBER" } });
  const p = await db.person.findUniqueOrThrow({ where: { id: personId } });
  await logActivity(eventId, `${p.name} ist jetzt Freigeber (${me.name})`);
  refresh(eventId);
}

export async function removeFreigeber(fd: FormData) {
  const { me, eventId } = await manageAccess(fd);
  const personId = Number(fd.get("personId"));
  await db.eventMember.deleteMany({ where: { eventId, personId, role: "FREIGEBER" } });
  const p = await db.person.findUnique({ where: { id: personId } });
  await logActivity(eventId, `${p?.name ?? "Person"} ist kein Freigeber mehr (${me.name})`);
  refresh(eventId);
}
