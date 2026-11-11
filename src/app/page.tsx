import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { today, formatDay, diffDays, addDays } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { setRsvp } from "./veranstaltungen/mitmachen";
import { formatMoney } from "@/lib/money";
import { kindLabel } from "@/lib/board";

// Startseite = Bürger-App für alle (auch die Orga sieht hier, was Bewohner sehen).
// Planungs-Themen stehen unter /planung; hier nur eine kompakte Karte dorthin.
export default async function Home({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const t = today();
  const { fehler } = await searchParams;

  const [events, news, waste, mine, slots, approvals, openPolls, boardLatest] = await Promise.all([
    db.event.findMany({ where: { status: "GEPLANT", published: true, date: { gte: t } }, orderBy: { date: "asc" }, take: 5, include: { rsvps: { where: { personId: me.id } }, group: { select: { name: true } } } }),
    db.newsPost.findMany({ orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }], take: 3 }),
    db.wasteDate.findMany({ where: { date: { gte: t, lte: addDays(t, 14) } }, orderBy: { date: "asc" }, take: 6 }),
    db.task.findMany({ where: { assigneeId: me.id, status: { not: "ERLEDIGT" } }, orderBy: { dueDate: "asc" }, take: 5, include: { event: { select: { title: true } } } }),
    db.helperSignup.findMany({ where: { personId: me.id, slot: { event: { date: { gte: t } } } }, take: 5, include: { slot: { include: { event: { select: { id: true, title: true, date: true } } } } } }),
    // Freigaben hängen an der Person (Freigeber pro Termin), nicht an der Rolle
    db.budgetItem.findMany({
      where: { status: "BEANTRAGT", OR: [{ requestedById: null }, { requestedById: { not: me.id } }], ...(me.role === "ADMIN" ? {} : { event: { members: { some: { personId: me.id, role: "FREIGEBER" } } } }) },
      orderBy: { createdAt: "asc" }, take: 20, include: { event: true, requestedBy: true },
    }),
    db.poll.findMany({ where: { closedAt: null, OR: [{ closesOn: null }, { closesOn: { gte: t } }], votes: { none: { personId: me.id } } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, closesOn: true } }),
    db.boardPost.findMany({ where: { expiresAt: { gt: new Date() }, status: "OFFEN" }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, category: true, kind: true } }),
  ]);
  const plan = orga ? await Promise.all([
    db.task.count({ where: { status: { not: "ERLEDIGT" }, event: { status: "GEPLANT" }, dueDate: { lt: t } } }),
    db.booking.count({ where: { status: "ANGEFRAGT" } }),
    db.issue.count({ where: { status: "NEU" } }),
    db.event.count({ where: { status: "GEPLANT", date: { gte: t } } }),
  ]) : null;

  const nextWaste = waste.filter((w) => w.date.getTime() === waste[0]?.date.getTime());
  const rsvpLabel = (s?: string) => (s === "JA" ? "Du kommst ✓" : s === "NEIN" ? "Du hast abgesagt" : s === "VIELLEICHT" ? "Vielleicht" : "Noch keine Antwort");

  return (
    <>
      <PageTitle>Hallo {me.name.split(" ")[0]}!</PageTitle>
      {fehler === "berechtigung" && <p className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">Dafür fehlt dir die Berechtigung.</p>}

      {plan && (
        <Link href="/planung" className="card mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 !py-3 hover:bg-brand-50">
          <span className="font-display text-2xl font-extrabold uppercase text-brand-600">Planung</span>
          <span className="text-sm text-stone-700">{plan[3]} Veranstaltung{plan[3] === 1 ? "" : "en"} in Planung{plan[0] ? <> · <b className="text-poster">{plan[0]} überfällig</b></> : ""}{plan[1] ? <> · <b>{plan[1]} Reservierungsanfrage{plan[1] === 1 ? "" : "n"}</b></> : ""}{plan[2] ? <> · <b>{plan[2]} neue{plan[2] === 1 ? "s" : ""} Anliegen</b></> : ""}</span>
          <span className="btn-sun ml-auto">Öffnen</span>
        </Link>
      )}

      {events[0] && (() => { const e = events[0]; const n = diffDays(e.date, t); const my = e.rsvps[0]?.status;
        const day = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }).format(e.date);
        return (
          <section className="mb-6 rounded-[10px] bg-poster p-5 text-white md:p-7">
            <div className="font-display text-base font-bold uppercase tracking-[0.15em] text-sun">Nächste Veranstaltung</div>
            <Link href={`/veranstaltungen/${e.id}`} className="block">
              <div className="font-display text-6xl font-extrabold uppercase leading-[0.9] md:text-8xl">{day}</div>
              <div className="font-script text-4xl leading-tight md:text-5xl">{e.title}</div>
            </Link>
            <div className="mt-1 text-lg font-semibold">{e.location ? `${e.location} · ` : ""}{n === 0 ? "heute" : `noch ${n} Tage`}</div>
            <form className="mt-4 flex flex-wrap gap-2"><input type="hidden" name="eventId" value={e.id} /><input type="hidden" name="guests" value={e.rsvps[0]?.guests ?? 0} />
              <button formAction={setRsvp.bind(null, "JA")} className={`min-h-[52px] flex-[1.3] rounded-md px-4 font-display text-2xl font-extrabold uppercase ${my === "JA" ? "bg-white text-brand-600" : "bg-sun text-ink"}`}>{my === "JA" ? "✓ Du kommst" : "Ich komme!"}</button>
              <button formAction={setRsvp.bind(null, "VIELLEICHT")} className={`min-h-[52px] flex-1 rounded-md border-[3px] border-white px-4 font-display text-xl font-bold uppercase ${my === "VIELLEICHT" ? "bg-white text-poster" : "text-white"}`}>Vielleicht</button>
              <button formAction={setRsvp.bind(null, "NEIN")} className={`min-h-[52px] rounded-md border-[3px] border-white px-4 font-display text-xl font-bold uppercase ${my === "NEIN" ? "bg-white text-poster" : "text-white"}`}>Kann nicht</button>
            </form>
          </section>
        ); })()}
      {!events.length && <p className="card mb-6 text-sm text-stone-600">Gerade sind keine Veranstaltungen angekündigt.</p>}

      {approvals.length > 0 && (
        <section className="card mb-4 !border-poster !shadow-[5px_5px_0_#BA1722]"><h2 className="mb-2 !text-poster">Zur Freigabe ({approvals.length})</h2>
          <ul>{approvals.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 border-t-2 border-stone-200 py-2 first:border-0">
              <span className="font-semibold">{a.title}</span><span className="font-display text-xl font-bold">{formatMoney(a.plannedCents)}</span>
              <span className="text-sm text-stone-600">{a.event.title}{a.requestedBy ? ` · von ${a.requestedBy.name}` : ""}</span>
              <Link href={`/veranstaltungen/${a.eventId}/budget`} className="btn-sun ml-auto">Prüfen</Link>
            </li>))}</ul></section>
      )}

      {openPolls.length > 0 && (
        <section className="card mb-4 !border-sun !shadow-[5px_5px_0_#FFCA01]"><div className="mb-2 flex justify-between"><h2>Deine Stimme ist gefragt</h2><Link href="/umfragen" className="text-sm font-semibold text-brand-600 hover:underline">Alle Umfragen →</Link></div>
          <ul>{openPolls.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-x-3 border-t-2 border-stone-200 py-2 first:border-0"><span className="font-semibold">{p.title}</span>{p.closesOn && <span className="text-sm text-stone-600">bis {formatDay(p.closesOn)}</span>}<Link href={`/umfragen#u${p.id}`} className="btn-sun ml-auto">Abstimmen</Link></li>)}</ul></section>
      )}

      {(mine.length > 0 || slots.length > 0) && (
        <section className="card mb-4"><div className="mb-2 flex justify-between"><h2>Mein Einsatz</h2><Link href="/meine-aufgaben" className="text-sm font-semibold text-brand-600 hover:underline">Alle →</Link></div>
          <ul className="text-sm">
            {slots.map((s) => <li key={`s${s.id}`} className="flex flex-wrap gap-x-2 border-t border-stone-100 py-1.5 first:border-0"><span className="font-medium">🙋 {s.slot.title}{s.slot.timeText ? ` (${s.slot.timeText})` : ""}</span><Link href={`/veranstaltungen/${s.slot.event.id}`} className="text-brand-600 hover:underline">{s.slot.event.title}</Link><span className="ml-auto text-stone-600">{formatDay(s.slot.event.date)}</span></li>)}
            {mine.map((x) => <li key={x.id} className="flex flex-wrap gap-x-2 border-t border-stone-100 py-1.5 first:border-0"><span className="font-medium">✔ {x.title}</span><span className="text-stone-500">{x.event.title}</span><span className={`ml-auto ${x.dueDate < t ? "font-semibold text-poster" : "text-stone-600"}`}>{formatDay(x.dueDate)}</span></li>)}
          </ul></section>
      )}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="card">
          <div className="mb-2 flex justify-between"><h2>Müllabfuhr</h2><Link href="/muell" className="text-sm font-semibold text-brand-600 hover:underline">Kalender →</Link></div>
          {nextWaste.length > 0 ? (<>
            <p className="font-display text-2xl font-bold">{diffDays(nextWaste[0].date, t) === 0 ? "Heute" : diffDays(nextWaste[0].date, t) === 1 ? "Morgen" : formatDay(nextWaste[0].date)}: {nextWaste.map((w) => w.type).join(", ")}</p>
            <ul className="mt-1 text-sm text-stone-600">{waste.filter((w) => !nextWaste.includes(w)).slice(0, 4).map((w) => <li key={w.id}>{formatDay(w.date)} · {w.type}</li>)}</ul>
          </>) : <p className="text-sm text-stone-500">In den nächsten 14 Tagen keine Abholung eingetragen.</p>}
        </section>
        <section className="card"><div className="mb-2 flex justify-between"><h2>Neuigkeiten</h2><Link href="/neuigkeiten" className="text-sm font-semibold text-brand-600 hover:underline">Alle →</Link></div>
          {news.map((n) => <article key={n.id} className="border-t border-stone-100 py-2 first:border-0"><h3 className="font-medium">{n.pinned && "📌 "}{n.title}</h3><p className="line-clamp-2 whitespace-pre-line text-sm text-stone-600">{n.body}</p></article>)}
          {!news.length && <p className="text-sm text-stone-500">Noch keine Neuigkeiten.</p>}</section>
      </div>

      {events.length > 1 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2"><h2>Weitere Termine</h2><Link href="/kalender" className="text-sm font-semibold text-brand-600 hover:underline">Kalender →</Link></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {events.slice(1).map((e) => (
              <Link key={e.id} href={`/veranstaltungen/${e.id}`} className="card block hover:bg-brand-50">
                <div className="font-display text-2xl font-extrabold uppercase text-brand-600">{e.title}</div>
                <div className="text-sm text-stone-600">{formatDay(e.date)} · noch {diffDays(e.date, t)} Tage{e.group ? ` · ${e.group.name}` : ""}</div>
                <div className="mt-1 text-sm font-semibold text-stone-600">{rsvpLabel(e.rsvps[0]?.status)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {boardLatest.length > 0 && (
        <section className="card mb-4"><div className="mb-2 flex justify-between"><h2>Schwarzes Brett</h2><Link href="/brett" className="text-sm font-semibold text-brand-600 hover:underline">Alle →</Link></div>
          <ul className="text-base">{boardLatest.map((b) => <li key={b.id} className="border-t-2 border-stone-200 py-1.5 first:border-0"><Link href={b.category === "FUNDBUERO" ? "/fundbuero" : "/brett"} className="font-semibold hover:text-brand-600">{b.title}</Link> <span className="text-xs text-stone-500">{kindLabel(b.category, b.kind)}</span></li>)}</ul></section>
      )}
    </>
  );
}
