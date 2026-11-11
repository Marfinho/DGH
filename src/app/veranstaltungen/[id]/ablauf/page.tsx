import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { groupByDay, dayHeading, timeRange } from "@/lib/plan";
import { EventHero } from "@/components/ui";
import { EventTabs } from "@/components/event-tabs";
import { PrintButton } from "@/components/print-button";
import { saveScheduleItem, deleteScheduleItem } from "../../plan-actions";

export default async function Ablauf({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
  await requireUser("ORGANISATOR");
  const id = Number((await params).id);
  const { fehler } = await searchParams;
  const [ev, people] = await Promise.all([
    db.event.findUnique({ where: { id }, include: { schedule: { include: { responsible: { select: { name: true, phone: true } } } } } }),
    db.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!ev) notFound();
  type It = (typeof ev.schedule)[number];
  const days = groupByDay(ev.schedule);

  const form = (it: It | null, dayOffset = 0) => (
    <form key={it ? `${it.id}-${it.dayOffset}-${it.time}-${it.endTime}-${it.title}-${it.place}-${it.note}-${it.isPublic}-${it.responsibleId}` : "neu"} action={saveScheduleItem} className="grid gap-2 sm:grid-cols-12">
      <input type="hidden" name="eventId" value={id} />{it && <input type="hidden" name="id" value={it.id} />}
      <select name="dayOffset" defaultValue={it?.dayOffset ?? dayOffset} className="input sm:col-span-3" aria-label="Tag">
        {Array.from({ length: 11 }, (_, i) => i - 5).map((o) => <option key={o} value={o}>{o === 0 ? "Veranstaltungstag" : o === -1 ? "Vortag" : o === 1 ? "Tag danach" : o < 0 ? `${-o} Tage vorher` : `${o} Tage danach`}</option>)}
      </select>
      <input name="time" defaultValue={it?.time ?? ""} placeholder="von 17:00" inputMode="numeric" pattern="\d{1,2}[:.]\d{2}" title="Uhrzeit, z. B. 17:00" className="input sm:col-span-2" aria-label="Beginn" />
      <input name="endTime" defaultValue={it?.endTime ?? ""} placeholder="bis (opt.)" inputMode="numeric" pattern="\d{1,2}[:.]\d{2}" title="Uhrzeit, z. B. 23:00" className="input sm:col-span-2" aria-label="Ende" />
      <input name="title" required maxLength={200} defaultValue={it?.title} placeholder="Was passiert? z. B. Anzünden des Feuers" className="input sm:col-span-5" aria-label="Programmpunkt" />
      <input name="place" maxLength={120} defaultValue={it?.place ?? ""} placeholder="Ort (optional)" className="input sm:col-span-3" aria-label="Ort" />
      <select name="responsibleId" defaultValue={it?.responsibleId ?? ""} className="input sm:col-span-3" aria-label="Verantwortlich"><option value="">– verantwortlich –</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input name="note" maxLength={500} defaultValue={it?.note ?? ""} placeholder="Notiz (optional)" className="input sm:col-span-6" aria-label="Notiz" />
      <label className="flex items-center gap-2 text-sm sm:col-span-8"><input type="checkbox" name="isPublic" defaultChecked={it?.isPublic ?? false} /> Im Programm für Bewohner zeigen (wenn die Veranstaltung veröffentlicht ist)</label>
      <button className={`${it ? "btn-light" : "btn"} sm:col-span-4`}>{it ? "Speichern" : "Hinzufügen"}</button>
    </form>
  );

  return (
    <>
      <div className="print:hidden"><EventHero kicker={`${formatDay(ev.date)}${ev.location ? ` · ${ev.location}` : ""}`} title={ev.title} /></div>
      <EventTabs id={id} active="ablauf" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-3xl">Ablaufplan</h1><p className="text-sm text-stone-600 print:hidden">Wer macht wann was – vom Aufbau bis zum Abbau. Zeiten hängen am Veranstaltungstag und wandern beim Verschieben mit.</p></div>
        <PrintButton label="Laufzettel drucken" />
      </div>
      <p className="mb-3 hidden text-lg font-bold print:block">{ev.title} · {formatDay(ev.date)}{ev.location ? ` · ${ev.location}` : ""}</p>
      {fehler && <p role="alert" className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">{fehler}</p>}

      {!days.length && <p className="card mb-4 text-sm text-stone-600">Noch kein Ablauf geplant. Leg unten den ersten Programmpunkt an – oder starte die Veranstaltung aus einer Vorlage mit Ablauf.</p>}
      {days.map((g) => (
        <section key={g.dayOffset} className="card mb-4 print:break-inside-avoid print:border print:shadow-none">
          <h2 className="mb-2">{dayHeading(ev.date, g.dayOffset)}</h2>
          <ol>
            {g.items.map((it) => (
              <li key={it.id} className="border-t-2 border-stone-200 py-2 first:border-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="w-28 shrink-0 font-display text-xl font-bold text-brand-600">{timeRange(it.time, it.endTime) || "ganztägig"}</span>
                  <span className="font-semibold">{it.title}</span>
                  {it.isPublic && <span className="rounded bg-sun px-1.5 text-xs font-bold uppercase print:hidden">Programm</span>}
                  <span className="text-sm text-stone-600">{[it.place, it.responsible ? `${it.responsible.name}${it.responsible.phone ? ` (${it.responsible.phone})` : ""}` : null].filter(Boolean).join(" · ")}</span>
                </div>
                {it.note && <p className="ml-0 text-sm text-stone-600 sm:ml-[7.75rem]">{it.note}</p>}
                <details className="mt-1 print:hidden"><summary className="cursor-pointer text-xs text-brand-600">Bearbeiten</summary>
                  <div className="mt-2">{form(it)}</div>
                  <form action={deleteScheduleItem} className="mt-2"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={it.id} /><button className="btn-danger">Löschen</button></form>
                </details>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <section className="card print:hidden"><h2 className="mb-2">Programmpunkt hinzufügen</h2>{form(null)}</section>
    </>
  );
}
