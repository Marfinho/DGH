import Link from "next/link";
import { db } from "@/lib/db";
import { today, formatDay, diffDays } from "@/lib/dates";
import { Progress, StatusBadge, PageTitle } from "@/components/ui";

export default async function Home() {
  const t = today();
  const events = await db.event.findMany({
    where: { status: "GEPLANT", date: { gte: t } }, orderBy: { date: "asc" }, include: { tasks: { select: { status: true } } },
  });
  const open = await db.task.findMany({
    where: { status: { not: "ERLEDIGT" }, event: { status: "GEPLANT" } }, orderBy: { dueDate: "asc" }, take: 40,
    include: { event: true, assignee: true },
  });
  const overdue = open.filter((x) => x.dueDate < t);
  const soon = open.filter((x) => x.dueDate >= t && diffDays(x.dueDate, t) <= 14);

  const row = (x: (typeof open)[number]) => (
    <li key={x.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-2 text-sm first:border-0">
      <StatusBadge status={x.status} />
      <span className="font-medium">{x.title}</span>
      <Link href={`/veranstaltungen/${x.eventId}`} className="text-brand-600 hover:underline">{x.event.title}</Link>
      <span className="text-stone-500">{x.assignee?.name ?? "niemand zugewiesen"}</span>
      <span className="ml-auto text-stone-600">{formatDay(x.dueDate)}</span>
    </li>
  );

  return (
    <>
      <PageTitle>Übersicht</PageTitle>
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Kommende Veranstaltungen</h2><Link href="/veranstaltungen/neu" className="btn">Neue Veranstaltung</Link></div>
        {events.length === 0 && <p className="text-sm text-stone-500">Keine anstehenden Veranstaltungen.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <Link key={e.id} href={`/veranstaltungen/${e.id}`} className="card block hover:border-brand-600">
              <div className="font-semibold">{e.title}</div>
              <div className="mb-2 text-sm text-stone-600">{formatDay(e.date)} · noch {diffDays(e.date, t)} Tage</div>
              <Progress done={e.tasks.filter((x) => x.status === "ERLEDIGT").length} total={e.tasks.length} />
            </Link>
          ))}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card"><h2 className="mb-2 font-semibold text-red-700">Überfällig ({overdue.length})</h2><ul>{overdue.map(row)}</ul>{!overdue.length && <p className="text-sm text-stone-500">Nichts überfällig 🎉</p>}</section>
        <section className="card"><h2 className="mb-2 font-semibold">Nächste 14 Tage ({soon.length})</h2><ul>{soon.map(row)}</ul>{!soon.length && <p className="text-sm text-stone-500">Keine Fristen in Sicht.</p>}</section>
      </div>
    </>
  );
}
