import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { today, formatDay } from "@/lib/dates";
import { PageTitle, StatusBadge } from "@/components/ui";
import { cycleTaskStatus } from "../veranstaltungen/actions";

export default async function MeineAufgaben() {
  const me = await requireUser();
  const t0 = today();
  const [tasks, slots] = await Promise.all([
    db.task.findMany({ where: { assigneeId: me.id, event: { status: { not: "ARCHIVIERT" } } }, orderBy: { dueDate: "asc" }, include: { event: true } }),
    db.helperSignup.findMany({ where: { personId: me.id, slot: { event: { date: { gte: t0 } } } }, include: { slot: { include: { event: true } } } }),
  ]);
  const open = tasks.filter((t) => t.status !== "ERLEDIGT"), done = tasks.filter((t) => t.status === "ERLEDIGT");
  const row = (t: (typeof tasks)[number]) => (
    <li key={t.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-2 first:border-0">
      <form action={cycleTaskStatus}><input type="hidden" name="id" value={t.id} /><button title="Status weiterschalten"><StatusBadge status={t.status} /></button></form>
      <span className={`font-medium ${t.status === "ERLEDIGT" ? "text-stone-400 line-through" : ""}`}>{t.title}</span>
      <span className="text-sm text-stone-500">{t.event.title}</span>
      <span className={`ml-auto text-sm ${t.status !== "ERLEDIGT" && t.dueDate < t0 ? "font-semibold text-poster" : "text-stone-600"}`}>{formatDay(t.dueDate)}</span>
    </li>
  );
  return (
    <>
      <PageTitle>Meine Aufgaben</PageTitle>
      <section className="card mb-4"><h2 className="mb-1 ">Offen ({open.length})</h2><ul>{open.map(row)}</ul>{!open.length && <p className="text-sm text-stone-500">Nichts zu tun – danke! 🎉</p>}</section>
      <section className="card mb-4"><h2 className="mb-1 ">Meine Helfer-Einsätze</h2>
        <ul>{slots.map((s) => <li key={s.id} className="border-t border-stone-100 py-2 first:border-0"><Link href={`/veranstaltungen/${s.slot.eventId}`} className="font-medium text-brand-600 hover:underline">{s.slot.title}</Link> <span className="text-sm text-stone-600">· {s.slot.event.title}, {formatDay(s.slot.event.date)}{s.slot.timeText ? `, ${s.slot.timeText}` : ""}</span></li>)}</ul>
        {!slots.length && <p className="text-sm text-stone-500">Du hast dich noch für keinen Einsatz eingetragen. Schau bei den <Link href="/veranstaltungen" className="text-brand-600 underline">Veranstaltungen</Link>.</p>}</section>
      {done.length > 0 && <section className="card"><h2 className="mb-1 text-stone-500">Erledigt ({done.length})</h2><ul>{done.map(row)}</ul></section>}
    </>
  );
}
