import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { today, formatDay, diffDays, addDays } from "@/lib/dates";
import { Progress, StatusBadge, PageTitle } from "@/components/ui";
import { setRsvp } from "./veranstaltungen/mitmachen";

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

      {events[0] && (() => { const e = events[0]; const n = diffDays(e.date, t); const mine = e.rsvps[0]?.status;
        const day = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }).format(e.date);
        return (
          <section className="mb-6 rounded-[10px] bg-poster p-5 text-white md:p-7">
            <div className="font-display text-base font-bold uppercase tracking-[0.15em] text-sun">Nächste Veranstaltung</div>
            <Link href={`/veranstaltungen/${e.id}`} className="block">
              <div className="font-display text-6xl font-extrabold uppercase leading-[0.9] md:text-8xl">{day}</div>
              <div className="font-script text-4xl leading-tight md:text-5xl">{e.title}</div>
            </Link>
            <div className="mt-1 text-lg font-semibold">{e.location ? `${e.location} · ` : ""}{n === 0 ? "heute" : `noch ${n} Tage`}</div>
            {orga ? <div className="mt-3"><Progress onDark done={e.tasks.filter((x) => x.status === "ERLEDIGT").length} total={e.tasks.length} /></div> : (
              <form action={setRsvp} className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="eventId" value={e.id} /><input type="hidden" name="guests" value={e.rsvps[0]?.guests ?? 0} />
                <button name="status" value="JA" className={`min-h-[52px] flex-[1.3] rounded-md px-4 font-display text-2xl font-extrabold uppercase ${mine === "JA" ? "bg-white text-brand-600" : "bg-sun text-ink"}`}>{mine === "JA" ? "✓ Du kommst" : "Ich komme!"}</button>
                <button name="status" value="VIELLEICHT" className={`min-h-[52px] flex-1 rounded-md border-[3px] border-white px-4 font-display text-xl font-bold uppercase ${mine === "VIELLEICHT" ? "bg-white text-poster" : "text-white"}`}>Vielleicht</button>
                <button name="status" value="NEIN" className={`min-h-[52px] rounded-md border-[3px] border-white px-4 font-display text-xl font-bold uppercase ${mine === "NEIN" ? "bg-white text-poster" : "text-white"}`}>Kann nicht</button>
              </form>
            )}
          </section>
        ); })()}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-2"><h2>{events.length > 1 ? "Weitere Veranstaltungen" : "Veranstaltungen"}</h2>{orga && <Link href="/veranstaltungen/neu" className="btn">Neue Veranstaltung</Link>}</div>
        {!events.length && <p className="text-sm text-stone-500">Keine anstehenden Veranstaltungen.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {events.slice(1).map((e) => (
            <Link key={e.id} href={`/veranstaltungen/${e.id}`} className="card block hover:bg-brand-50">
              <div className="font-display text-2xl font-extrabold uppercase text-brand-600">{e.title}</div>
              <div className="mb-2 text-sm text-stone-600">{formatDay(e.date)} · noch {diffDays(e.date, t)} Tage</div>
              {orga ? <Progress done={e.tasks.filter((x) => x.status === "ERLEDIGT").length} total={e.tasks.length} />
                : <div className="text-sm font-semibold text-stone-600">{e.rsvps[0] ? `Deine Antwort: ${e.rsvps[0].status === "JA" ? "Zusage ✓" : e.rsvps[0].status === "NEIN" ? "Absage" : "Vielleicht"}` : "Noch keine Antwort von dir"}</div>}
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="card"><h2 className="mb-2">Meine Aufgaben</h2><ul className="text-sm">{mine.map((x) => <li key={x.id} className="flex gap-2 border-t border-stone-100 py-1.5 first:border-0"><span className="font-medium">{x.title}</span><span className="ml-auto text-stone-600">{formatDay(x.dueDate)}</span></li>)}</ul>{!mine.length && <p className="text-sm text-stone-500">Keine offenen Aufgaben.</p>}<Link href="/meine-aufgaben" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Alle ansehen →</Link></section>
        <section className="card"><h2 className="mb-2">Müllabfuhr (14 Tage)</h2><ul className="text-sm">{waste.map((w) => <li key={w.id} className="flex gap-2 border-t border-stone-100 py-1.5 first:border-0"><span>🗑 {w.type}</span><span className="ml-auto text-stone-600">{formatDay(w.date)}</span></li>)}</ul>{!waste.length && <p className="text-sm text-stone-500">Keine Termine hinterlegt.</p>}</section>
      </div>

      <section className="card mb-4"><div className="mb-2 flex justify-between"><h2>Neuigkeiten</h2><Link href="/neuigkeiten" className="text-sm text-brand-600 hover:underline">Alle →</Link></div>
        {news.map((n) => <article key={n.id} className="border-t border-stone-100 py-2 first:border-0"><h3 className="font-medium">{n.pinned && "📌 "}{n.title}</h3><p className="line-clamp-2 whitespace-pre-line text-sm text-stone-600">{n.body}</p></article>)}
        {!news.length && <p className="text-sm text-stone-500">Noch keine Neuigkeiten.</p>}</section>

      {orga && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card"><h2 className="mb-2 !text-poster">Überfällig ({overdue.length})</h2><ul>{overdue.map(row)}</ul>{!overdue.length && <p className="text-sm text-stone-500">Nichts überfällig 🎉</p>}</section>
          <section className="card"><h2 className="mb-2">Nächste 14 Tage ({soon.length})</h2><ul>{soon.map(row)}</ul>{!soon.length && <p className="text-sm text-stone-500">Keine Fristen in Sicht.</p>}</section>
        </div>
      )}
    </>
  );
}
