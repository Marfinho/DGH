import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { today, formatDay, diffDays, addDays } from "@/lib/dates";
import { materialSummary } from "@/lib/plan";
import { PageTitle, StatusBadge } from "@/components/ui";

/** Orga-Zentrale: alles, was die Planung braucht, auf einer Seite. */
export default async function Planung() {
  await requireUser("ORGANISATOR");
  const t = today();
  const [events, tasks, bookings, issues, reportedBrett, reportedFund, nextMeeting, openTodos] = await Promise.all([
    db.event.findMany({
      where: { status: "GEPLANT" }, orderBy: { date: "asc" },
      include: {
        tasks: { select: { status: true, dueDate: true } }, material: { select: { status: true } },
        slots: { select: { capacity: true, _count: { select: { signups: true } } } },
        rsvps: { where: { status: "JA" }, select: { guests: true } },
        budgetItems: { where: { status: "BEANTRAGT" }, select: { id: true } },
        _count: { select: { schedule: true } }, group: { select: { name: true } },
      },
    }),
    db.task.findMany({ where: { status: { not: "ERLEDIGT" }, event: { status: "GEPLANT" }, dueDate: { lte: addDays(t, 14) } }, orderBy: { dueDate: "asc" }, take: 60, include: { event: { select: { title: true } }, assignee: { select: { name: true } } } }),
    db.booking.count({ where: { status: "ANGEFRAGT" } }),
    db.issue.count({ where: { status: "NEU" } }),
    db.boardPost.count({ where: { reportedAt: { not: null }, category: { not: "FUNDBUERO" } } }),
    db.boardPost.count({ where: { reportedAt: { not: null }, category: "FUNDBUERO" } }),
    db.meeting.findFirst({ where: { date: { gte: t } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], include: { invitees: { select: { response: true } }, _count: { select: { agenda: true } } } }),
    db.meetingTodo.count({ where: { done: false } }),
  ]);
  const overdue = tasks.filter((x) => x.dueDate < t), soon = tasks.filter((x) => x.dueDate >= t);
  const inbox: [string, string, number][] = [
    ["/reservierung", "Reservierungsanfragen", bookings], ["/anliegen?status=NEU", "Neue Anliegen", issues],
    ["/brett", "Gemeldete Beiträge im Brett", reportedBrett], ["/fundbuero", "Gemeldete Beiträge im Fundbüro", reportedFund]
  ];

  const row = (x: (typeof tasks)[number]) => (
    <li key={x.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-2 text-sm first:border-0">
      <StatusBadge status={x.status} /><span className="font-medium">{x.title}</span>
      <Link href={`/veranstaltungen/${x.eventId}`} className="text-brand-600 hover:underline">{x.event.title}</Link>
      <span className="text-stone-500">{x.assignee?.name ?? <span className="font-semibold text-poster">niemand zugewiesen</span>}</span><span className="ml-auto text-stone-600">{formatDay(x.dueDate)}</span>
    </li>
  );
  const stat = (label: string, value: string, warn = false) => (
    <div className={`rounded-md border-2 px-2 py-1 ${warn ? "border-poster text-poster" : "border-stone-200"}`}><div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div><div className="font-display text-xl font-bold">{value}</div></div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Planung</PageTitle>
        <div className="mb-5 flex flex-wrap gap-2"><Link href="/veranstaltungen/neu" className="btn">Neue Veranstaltung</Link></div>
      </div>

      {inbox.some(([, , n]) => n > 0) && (
        <section className="card mb-6 !border-sun !shadow-[5px_5px_0_#FFCA01]"><h2 className="mb-2">Eingang</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{inbox.filter(([, , n]) => n > 0).map(([href, label, n]) => (
            <li key={label}><Link href={href} className="flex min-h-[48px] items-center justify-between rounded-md border-2 border-brand-600 px-3 font-semibold hover:bg-brand-50">{label}<span className="rounded bg-sun px-2 font-display text-xl font-bold">{n}</span></Link></li>))}</ul>
        </section>
      )}

      <Link href={nextMeeting ? `/versammlungen/${nextMeeting.id}` : "/versammlungen"} className="card mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 !py-3 hover:bg-brand-50">
        <span className="font-display text-2xl font-extrabold uppercase text-brand-600">Versammlung</span>
        <span className="text-sm text-stone-700">{nextMeeting ? <>Nächste: <b>{nextMeeting.title}</b>, {formatDay(nextMeeting.date)}, {nextMeeting.startTime} Uhr · {nextMeeting.invitees.filter((i) => i.response === "ZUGESAGT").length} Zusagen · {nextMeeting._count.agenda} TOPs</> : "Keine Versammlung geplant – jetzt einladen"}{openTodos ? <> · <b>{openTodos} offene To-dos</b></> : ""}</span>
        <span className="btn-light ml-auto !min-h-[40px]">{nextMeeting ? "Öffnen" : "Planen"}</span>
      </Link>

      <h2 className="mb-3">Laufende Planungen</h2>
      {!events.length && <p className="card mb-6 text-sm text-stone-600">Gerade wird nichts geplant. <Link href="/veranstaltungen/neu" className="font-semibold text-brand-600 underline">Neue Veranstaltung</Link> – am besten aus einer Vorlage.</p>}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {events.map((e) => {
          const done = e.tasks.filter((x) => x.status === "ERLEDIGT").length;
          const late = e.tasks.filter((x) => x.status !== "ERLEDIGT" && x.dueDate < t).length;
          const mat = materialSummary(e.material);
          const cap = e.slots.reduce((a, s) => a + s.capacity, 0), filled = e.slots.reduce((a, s) => a + Math.min(s._count.signups, s.capacity), 0);
          const guests = e.rsvps.length + e.rsvps.reduce((a, r) => a + r.guests, 0);
          const n = diffDays(e.date, t);
          return (
            <article key={e.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/veranstaltungen/${e.id}`} className="font-display text-2xl font-extrabold uppercase text-brand-600 hover:underline">{e.title}</Link>
                  <div className="text-sm text-stone-600">{formatDay(e.date)} · {n < 0 ? "vorbei – abschließen?" : n === 0 ? "heute" : `noch ${n} Tage`}{e.group ? ` · ${e.group.name}` : ""}</div>
                </div>
                <span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase ${e.published ? "bg-brand-600 text-white" : "bg-amber-100 text-amber-800"}`}>{e.published ? "veröffentlicht" : "Entwurf"}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {stat("Aufgaben", `${done}/${e.tasks.length}`)}
                {stat("überfällig", String(late), late > 0)}
                {stat("Material", mat.total ? `${mat.done}/${mat.total}` : "–")}
                {stat("Helfer", cap ? `${filled}/${cap}` : "–", cap > 0 && filled < cap && n <= 14)}
                {stat("Zusagen", String(guests))}
                {stat("Freigaben", String(e.budgetItems.length), e.budgetItems.length > 0)}
              </div>
              <nav aria-label={`Bereiche von ${e.title}`} className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-brand-600">
                <Link href={`/veranstaltungen/${e.id}`} className="hover:underline">Aufgaben</Link>
                <Link href={`/veranstaltungen/${e.id}/ablauf`} className="hover:underline">Ablauf{e._count.schedule ? ` (${e._count.schedule})` : ""}</Link>
                <Link href={`/veranstaltungen/${e.id}/material`} className="hover:underline">Material</Link>
                <Link href={`/veranstaltungen/${e.id}/budget`} className="hover:underline">Budget</Link>
                <Link href={`/veranstaltungen/${e.id}?ansicht=buerger`} className="hover:underline">Bürgeransicht</Link>
              </nav>
            </article>
          );
        })}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="card"><h2 className="mb-2 !text-poster">Überfällig ({overdue.length})</h2><ul>{overdue.map(row)}</ul>{!overdue.length && <p className="text-sm text-stone-500">Nichts überfällig 🎉</p>}</section>
        <section className="card"><h2 className="mb-2">Nächste 14 Tage ({soon.length})</h2><ul>{soon.map(row)}</ul>{!soon.length && <p className="text-sm text-stone-500">Keine Fristen in Sicht.</p>}</section>
      </div>

      <h2 className="mb-3">Werkzeuge</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {([["/versammlungen", "Versammlungen", "Einladen, Tagesordnung, Protokoll"], ["/vorlagen", "Vorlagen", "Osterfeuer, Dorffest, Weihnachtsmarkt …"], ["/kalender", "Kalender", "Monatsansicht aller Termine"], ["/archiv", "Archiv & Jahresvergleich", "Vergangene Veranstaltungen, Lessons Learned"],
          ["/aushang", "Aushang drucken", "DIN-A4 für den Schaukasten"], ["/umfragen", "Umfrage starten", "Termin finden, Meinungen einholen"], ["/neuigkeiten", "Neuigkeit schreiben", "mit Push an alle"]] as const).map(([h, l, d]) => (
          <li key={h}><Link href={h} className="card block !py-3 hover:bg-brand-50"><span className="font-display text-xl font-bold uppercase text-brand-600">{l}</span><span className="block text-sm text-stone-600">{d}</span></Link></li>
        ))}
      </ul>
    </>
  );
}
