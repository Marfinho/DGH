import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { today, formatDay, toInput } from "@/lib/dates";
import { CAL_KINDS, CAL_LABEL, byDay, monthGrid, monthKey, parseKinds, parseMonth, shiftMonth, toggleKind, type CalEntry, type CalKind } from "@/lib/calendar";
import { PageTitle } from "@/components/ui";

const COLOR: Record<CalKind, string> = {
  TERMIN: "bg-poster text-white", VERSAMMLUNG: "bg-ink text-white", MUELL: "bg-stone-500 text-white", LEIHEN: "bg-sun text-ink", AUFGABE: "bg-brand-600 text-white", UMFRAGE: "border-2 border-ink bg-white text-ink",
};
const ICON: Record<CalKind, string> = { TERMIN: "🎉", VERSAMMLUNG: "👥", MUELL: "🗑", LEIHEN: "🏠", AUFGABE: "✔", UMFRAGE: "🗳" };

export default async function Kalender({ searchParams }: { searchParams: Promise<{ monat?: string; zeige?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const sp = await searchParams;
  const t = today();
  const month = parseMonth(sp.monat, t);
  const weeks = monthGrid(month);
  const from = weeks[0][0], to = weeks.at(-1)!.at(-1)!;
  const kinds = parseKinds(sp.zeige);
  const on = (k: CalKind) => kinds.includes(k);
  const none = Promise.resolve([] as never[]);

  const [events, waste, bookings, tasks, polls, meetings, mtodos] = await Promise.all([
    on("TERMIN") ? db.event.findMany({
      where: { date: { gte: from, lte: to }, ...(orga ? {} : { published: true, status: { not: "ARCHIVIERT" } }) },
      select: { id: true, title: true, date: true, location: true, published: true, group: { select: { name: true } }, rsvps: { where: { personId: me.id }, select: { status: true } } },
    }) : none,
    on("MUELL") ? db.wasteDate.findMany({ where: { date: { gte: from, lte: to } }, select: { id: true, type: true, date: true } }) : none,
    on("LEIHEN") ? db.booking.findMany({
      where: { startDate: { lte: to }, endDate: { gte: from }, OR: [{ status: "BESTAETIGT" }, { personId: me.id, status: "ANGEFRAGT" }, ...(orga ? [{ status: "ANGEFRAGT" }] : [])] },
      select: { id: true, startDate: true, endDate: true, status: true, timeText: true, personId: true, resource: { select: { name: true } }, person: { select: { name: true } } },
    }) : none,
    on("AUFGABE") ? db.task.findMany({ where: { assigneeId: me.id, status: { not: "ERLEDIGT" }, dueDate: { gte: from, lte: to } }, select: { id: true, title: true, dueDate: true, eventId: true, event: { select: { title: true } } } }) : none,
    on("UMFRAGE") ? db.poll.findMany({ where: { closedAt: null, closesOn: { gte: from, lte: to } }, select: { id: true, title: true, closesOn: true } }) : none,
    orga && on("VERSAMMLUNG") ? db.meeting.findMany({ where: { date: { gte: from, lte: to } }, select: { id: true, title: true, date: true, startTime: true, location: true } }) : none,
    on("AUFGABE") ? db.meetingTodo.findMany({ where: { assigneeId: me.id, done: false, dueDate: { gte: from, lte: to } }, select: { id: true, title: true, dueDate: true, meeting: { select: { title: true } } } }) : none,
  ]);

  const entries: CalEntry[] = [
    ...events.map((e): CalEntry => ({
      kind: "TERMIN", title: e.title, start: e.date, href: `/veranstaltungen/${e.id}`, draft: !e.published, mine: e.rsvps[0]?.status === "JA",
      note: [e.location, e.group?.name, e.rsvps[0]?.status === "JA" ? "du kommst" : null].filter(Boolean).join(" · ") || undefined,
    })),
    ...waste.map((w): CalEntry => ({ kind: "MUELL", title: w.type, start: w.date, href: "/muell" })),
    ...bookings.map((b): CalEntry => {
      const own = b.personId === me.id, req = b.status === "ANGEFRAGT";
      return {
        kind: "LEIHEN", start: b.startDate, end: b.endDate, href: "/reservierung", mine: own,
        title: own ? `${b.resource.name} (deine Reservierung${req ? ", angefragt" : ""})` : `${b.resource.name} ${req ? "angefragt" : "belegt"}`,
        note: [b.timeText, orga && !own ? b.person.name : null].filter(Boolean).join(" · ") || undefined,
      };
    }),
    ...tasks.map((x): CalEntry => ({ kind: "AUFGABE", title: `Frist: ${x.title}`, start: x.dueDate, href: "/meine-aufgaben", note: x.event.title, mine: true })),
    ...meetings.map((m): CalEntry => ({ kind: "VERSAMMLUNG", title: `${m.startTime} ${m.title}`, start: m.date, href: `/versammlungen/${m.id}`, note: m.location ?? undefined })),
    ...mtodos.map((x): CalEntry => ({ kind: "AUFGABE", title: `To-do: ${x.title}`, start: x.dueDate!, href: "/meine-aufgaben", note: x.meeting.title, mine: true })),
    ...polls.map((p): CalEntry => ({ kind: "UMFRAGE", title: `Umfrage endet: ${p.title}`, start: p.closesOn!, href: `/umfragen#u${p.id}` })),
  ];
  const days = byDay(entries, from, to);
  const monthName = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const q = (o: { monat?: string; zeige?: CalKind[] }) => {
    const z = o.zeige ?? kinds;
    const p = new URLSearchParams({ monat: o.monat ?? monthKey(month), ...(z.length === CAL_KINDS.length ? {} : { zeige: z.join(",") }) });
    return `/kalender?${p}`;
  };
  // „Meine Fristen“ nur für Leute, die überhaupt Aufgaben haben (die meisten Bewohner nicht)
  const hasTasks = orga || (await db.task.count({ where: { assigneeId: me.id, status: { not: "ERLEDIGT" } } })) + (await db.meetingTodo.count({ where: { assigneeId: me.id, done: false } })) > 0;
  const visibleKinds = CAL_KINDS.filter((k) => (k !== "AUFGABE" || hasTasks) && (k !== "VERSAMMLUNG" || orga));
  const agenda = weeks.flat().filter((d) => d.getUTCMonth() === month.getUTCMonth() && days.has(toInput(d)));
  const todayKey = toInput(t);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Kalender</PageTitle>
        <div className="mb-5 flex gap-2"><Link href="/veranstaltungen" className="btn-light">Liste</Link><span className="btn" aria-current="page">Monat</span></div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <Link href={q({ monat: monthKey(shiftMonth(month, -1)) })} className="btn-light !px-3" aria-label="Voriger Monat">‹</Link>
        <div className="text-center">
          <h2 className="text-3xl capitalize md:text-4xl">{monthName}</h2>
          {monthKey(month) !== monthKey(t) && <Link href={q({ monat: monthKey(t) })} className="text-sm font-semibold text-brand-600 hover:underline">Heute</Link>}
        </div>
        <Link href={q({ monat: monthKey(shiftMonth(month, 1)) })} className="btn-light !px-3" aria-label="Nächster Monat">›</Link>
      </div>

      <nav aria-label="Anzeigen" className="mb-4 flex flex-wrap gap-2">
        {visibleKinds.map((k) => (
          <Link key={k} href={q({ zeige: toggleKind(kinds, k) })} aria-pressed={on(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on(k) ? COLOR[k] : "border-2 border-stone-300 bg-white text-stone-400 line-through"}`}>
            {ICON[k]} {CAL_LABEL[k]}
          </Link>
        ))}
      </nav>

      <div className="card !p-2 md:!p-3">
        <div className="grid grid-cols-7 gap-1 text-center font-display text-sm font-bold uppercase text-stone-500">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div key={w}>{w}</div>)}
        </div>
        {weeks.map((w) => (
          <div key={toInput(w[0])} className="mt-1 grid grid-cols-7 gap-1">
            {w.map((d) => {
              const k = toInput(d), list = days.get(k) ?? [], other = d.getUTCMonth() !== month.getUTCMonth();
              const inner = (
                <>
                  <div className={`mb-0.5 text-sm font-bold ${k === todayKey ? "mx-auto inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white md:mx-0" : ""}`}>{d.getUTCDate()}</div>
                  {/* Handy: farbige Punkte */}
                  <div className="flex flex-wrap justify-center gap-0.5 md:hidden">{list.slice(0, 4).map((e, i) => <span key={i} className={`h-2 w-2 rounded-full ${COLOR[e.kind].replace(/text-\S+/g, "")}`} />)}</div>
                  {/* Desktop: Titel */}
                  <ul className="hidden space-y-0.5 md:block">
                    {list.slice(0, 3).map((e, i) => <li key={i} className={`truncate rounded px-1 text-left text-xs font-semibold leading-5 ${COLOR[e.kind]} ${e.draft ? "opacity-60" : ""}`} title={e.title}>{e.mine && e.kind === "TERMIN" ? "✓ " : ""}{e.title}</li>)}
                    {list.length > 3 && <li className="text-left text-xs font-semibold text-stone-500">+{list.length - 3} weitere</li>}
                  </ul>
                </>
              );
              const cls = `block min-h-[56px] rounded-md border p-1 text-center md:min-h-[104px] md:text-left ${other ? "border-transparent bg-stone-50 text-stone-400" : "border-stone-200"}`;
              return list.length && !other
                ? <a key={k} href={`#d-${k}`} className={`${cls} hover:border-brand-600`} aria-label={`${formatDay(d)}: ${list.length} Einträge`}>{inner}</a>
                : <div key={k} className={cls}>{inner}</div>;
            })}
          </div>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-3">Alles im {new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" }).format(month)}</h2>
        {!agenda.length && <p className="text-sm text-stone-500">In diesem Monat steht nichts an.</p>}
        <ol className="space-y-3">
          {agenda.map((d) => { const k = toInput(d); return (
            <li key={k} id={`d-${k}`} className={`card scroll-mt-24 !py-3 ${k === todayKey ? "!border-sun" : ""} ${d < t ? "opacity-70" : ""}`}>
              <h3 className="mb-1 font-display text-xl font-bold uppercase text-brand-600">{formatDay(d)}{k === todayKey ? " · heute" : ""}</h3>
              <ul className="space-y-1.5">
                {days.get(k)!.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 text-xs font-bold leading-5 ${COLOR[e.kind]}`} aria-label={CAL_LABEL[e.kind]}>{ICON[e.kind]}</span>
                    <span>
                      {e.href ? <Link href={e.href} className="font-semibold hover:text-brand-600 hover:underline">{e.title}</Link> : <span className="font-semibold">{e.title}</span>}
                      {e.draft && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Entwurf</span>}
                      {e.note && <span className="block text-sm text-stone-600">{e.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ); })}
        </ol>
      </section>
    </>
  );
}
