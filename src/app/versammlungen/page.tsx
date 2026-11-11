import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { today, formatDay, toInput } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { createMeeting } from "./actions";

export default async function Versammlungen({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const me = await requireUser("ORGANISATOR");
  const { fehler } = await searchParams;
  const t = today();
  const [meetings, openTodos] = await Promise.all([
    db.meeting.findMany({ orderBy: { date: "desc" }, take: 60, include: { _count: { select: { agenda: true } }, invitees: { select: { personId: true, response: true } }, todos: { select: { done: true } } } }),
    db.meetingTodo.findMany({ where: { done: false }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], include: { assignee: { select: { name: true } }, meeting: { select: { id: true, title: true, date: true } } } }),
  ]);
  const upcoming = meetings.filter((m) => m.date >= t).reverse(), past = meetings.filter((m) => m.date < t);

  const card = (m: (typeof meetings)[number]) => {
    const mine = m.invitees.find((i) => i.personId === me.id)?.response;
    const yes = m.invitees.filter((i) => i.response === "ZUGESAGT").length;
    return (
      <li key={m.id}><Link href={`/versammlungen/${m.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 !py-3 hover:bg-brand-50">
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl font-extrabold uppercase text-brand-600">{m.title}</div>
          <div className="text-sm text-stone-600">{formatDay(m.date)}, {m.startTime} Uhr{m.location ? ` · ${m.location}` : ""} · {m._count.agenda} TOPs</div>
        </div>
        {m.date >= t
          ? <span className="text-sm font-semibold">{yes} Zusagen{mine === "ZUGESAGT" ? " · du kommst" : mine === "ABGESAGT" ? " · du hast abgesagt" : ""}</span>
          : <span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase ${m.finalizedAt ? "bg-brand-600 text-white" : "bg-sun text-ink"}`}>{m.finalizedAt ? "Protokoll fertig" : "Protokoll offen"}</span>}
      </Link></li>
    );
  };

  return (
    <>
      <PageTitle>Versammlungen</PageTitle>
      <p className="mb-4 text-stone-600">Treffen des Orga-Teams: Termin festlegen, per Mail einladen, Protokoll führen. Nur für Orga und Admins sichtbar.</p>
      {fehler && <p role="alert" className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">{fehler}</p>}

      <details className="card mb-6" open={!upcoming.length}>
        <summary className="cursor-pointer font-display text-xl font-bold uppercase text-brand-600">+ Neue Versammlung</summary>
        <form action={createMeeting} className="mt-3 grid gap-2 sm:grid-cols-12">
          <input name="title" defaultValue="Orga-Treffen" maxLength={120} required className="input sm:col-span-12" aria-label="Titel" />
          <div className="sm:col-span-4"><label className="label" htmlFor="d">Datum</label><input id="d" type="date" name="date" required min={toInput(t)} className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="s">Beginn</label><input id="s" type="time" name="startTime" required defaultValue="19:30" className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="e">Ende (opt.)</label><input id="e" type="time" name="endTime" className="input" /></div>
          <div className="sm:col-span-4"><label className="label" htmlFor="o">Ort</label><input id="o" name="location" maxLength={200} placeholder="z. B. Gemeindehaus" className="input" /></div>
          <div className="sm:col-span-6"><label className="label" htmlFor="a">Tagesordnung – ein Punkt pro Zeile</label><textarea id="a" name="agenda" rows={5} maxLength={5000} className="input" placeholder={"Begrüßung, Protokoll der letzten Sitzung\nOsterfeuer: Stand der Planung\nKasse\nVerschiedenes"} /></div>
          <div className="sm:col-span-6"><label className="label" htmlFor="i">Text für die Einladung (optional)</label><textarea id="i" name="invitationText" rows={5} maxLength={2000} className="input" placeholder="z. B. Bitte bringt eure Ideen für das Sommerfest mit." /></div>
          <p className="text-sm text-stone-600 sm:col-span-8">Eingeladen werden zunächst alle mit Orga- oder Admin-Rolle – anpassbar, bevor die Einladung rausgeht.</p>
          <button className="btn sm:col-span-4">Anlegen</button>
        </form>
      </details>

      {openTodos.length > 0 && (
        <section className="card mb-6"><h2 className="mb-2">Offene To-dos ({openTodos.length})</h2>
          <ul className="text-sm">{openTodos.map((x) => (
            <li key={x.id} className="flex flex-wrap gap-x-3 border-t border-stone-100 py-1.5 first:border-0">
              <span className="font-semibold">{x.title}</span><span className="text-stone-600">{x.assignee?.name ?? "niemand"}</span>
              <Link href={`/versammlungen/${x.meeting.id}`} className="text-brand-600 hover:underline">{x.meeting.title}, {formatDay(x.meeting.date)}</Link>
              {x.dueDate && <span className={`ml-auto ${x.dueDate < t ? "font-semibold text-poster" : "text-stone-600"}`}>bis {formatDay(x.dueDate)}</span>}
            </li>))}</ul></section>
      )}

      <h2 className="mb-2">Anstehend</h2>
      <ul className="mb-6 space-y-3">{upcoming.map(card)}</ul>
      {!upcoming.length && <p className="mb-6 text-sm text-stone-500">Keine Versammlung geplant.</p>}
      {past.length > 0 && <><h2 className="mb-2">Vergangene & Protokolle</h2><ul className="space-y-3">{past.map(card)}</ul></>}
    </>
  );
}
