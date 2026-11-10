import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { today, formatDay, diffDays, addDays } from "@/lib/dates";
import { Progress, StatusBadge, PageTitle } from "@/components/ui";

export default async function Home({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const t = today();
  const { fehler } = await searchParams;

  const [events, news, waste, mine] = await Promise.all([
    db.event.findMany({
      where: { status: "GEPLANT", date: { gte: t }, ...(orga ? {} : { published: true }) }, orderBy: { date: "asc" }, take: 6,
      include: { tasks: { select: { status: true } }, rsvps: { where: { personId: me.id } } },
    }),
    db.newsPost.findMany({ orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }], take: 3 }),
    db.wasteDate.findMany({ where: { date: { gte: t, lte: addDays(t, 14) } }, orderBy: { date: "asc" }, take: 6 }),
    db.task.findMany({ where: { assigneeId: me.id, status: { not: "ERLEDIGT" } }, orderBy: { dueDate: "asc" }, take: 5, include: { event: true } }),
  ]);
  const open = orga ? await db.task.findMany({ where: { status: { not: "ERLEDIGT" }, event: { status: "GEPLANT" }, dueDate: { lte: addDays(t, 14) } }, orderBy: { dueDate: "asc" }, take: 40, include: { event: true, assignee: true } }) : [];
  const overdue = open.filter((x) => x.dueDate < t), soon = open.filter((x) => x.dueDate >= t);

  const row = (x: (typeof open)[number]) => (
    <li key={x.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-2 text-sm first:border-0">
      <StatusBadge status={x.status} /><span className="font-medium">{x.title}</span>
      <Link href={`/veranstaltungen/${x.eventId}`} className="text-brand-600 hover:underline">{x.event.title}</Link>
      <span className="text-stone-500">{x.assignee?.name ?? "niemand zugewiesen"}</span><span className="ml-auto text-stone-600">{formatDay(x.dueDate)}</span>
    </li>
  );

  return (
    <>
      <PageTitle>Hallo {me.name.split(" ")[0]}!</PageTitle>
      {fehler === "berechtigung" && <p className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">Dafür fehlt dir die Berechtigung.</p>}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Kommende Veranstaltungen</h2>{orga && <Link href="/veranstaltungen/neu" className="btn">Neue Veranstaltung</Link>}</div>
        {!events.length && <p className="text-sm text-stone-500">Keine anstehenden Veranstaltungen.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <Link key={e.id} href={`/veranstaltungen/${e.id}`} className="card block hover:border-brand-600">
              <div className="font-semibold">{e.title}</div>
              <div className="mb-2 text-sm text-stone-600">{formatDay(e.date)} · {diffDays(e.date, t) === 0 ? "heute" : `noch ${diffDays(e.date, t)} Tage`}</div>
              {orga ? <Progress done={e.tasks.filter((x) => x.status === "ERLEDIGT").length} total={e.tasks.length} />
                : <div className="text-xs text-stone-600">{e.rsvps[0] ? `Deine Antwort: ${e.rsvps[0].status === "JA" ? "Zusage ✓" : e.rsvps[0].status === "NEIN" ? "Absage" : "Vielleicht"}` : "Noch keine Antwort von dir"}</div>}
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="card"><h2 className="mb-2 font-semibold">Meine Aufgaben</h2><ul className="text-sm">{mine.map((x) => <li key={x.id} className="flex gap-2 border-t border-stone-100 py-1.5 first:border-0"><span className="font-medium">{x.title}</span><span className="ml-auto text-stone-600">{formatDay(x.dueDate)}</span></li>)}</ul>{!mine.length && <p className="text-sm text-stone-500">Keine offenen Aufgaben.</p>}<Link href="/meine-aufgaben" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Alle ansehen →</Link></section>
        <section className="card"><h2 className="mb-2 font-semibold">Müllabfuhr (14 Tage)</h2><ul className="text-sm">{waste.map((w) => <li key={w.id} className="flex gap-2 border-t border-stone-100 py-1.5 first:border-0"><span>🗑 {w.type}</span><span className="ml-auto text-stone-600">{formatDay(w.date)}</span></li>)}</ul>{!waste.length && <p className="text-sm text-stone-500">Keine Termine hinterlegt.</p>}</section>
      </div>

      <section className="card mb-4"><div className="mb-2 flex justify-between"><h2 className="font-semibold">Neuigkeiten</h2><Link href="/neuigkeiten" className="text-sm text-brand-600 hover:underline">Alle →</Link></div>
        {news.map((n) => <article key={n.id} className="border-t border-stone-100 py-2 first:border-0"><h3 className="font-medium">{n.pinned && "📌 "}{n.title}</h3><p className="line-clamp-2 whitespace-pre-line text-sm text-stone-600">{n.body}</p></article>)}
        {!news.length && <p className="text-sm text-stone-500">Noch keine Neuigkeiten.</p>}</section>

      {orga && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card"><h2 className="mb-2 font-semibold text-red-700">Überfällig ({overdue.length})</h2><ul>{overdue.map(row)}</ul>{!overdue.length && <p className="text-sm text-stone-500">Nichts überfällig 🎉</p>}</section>
          <section className="card"><h2 className="mb-2 font-semibold">Nächste 14 Tage ({soon.length})</h2><ul>{soon.map(row)}</ul>{!soon.length && <p className="text-sm text-stone-500">Keine Fristen in Sicht.</p>}</section>
        </div>
      )}
    </>
  );
}
