import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { today, formatDay, toInput, addDays } from "@/lib/dates";
import { BLOCKING, BOOKING_LABEL, RESOURCE_KINDS, RESOURCE_LABEL, MAX_DAYS, occupancy, type BookingStatus } from "@/lib/bookings";
import { PageTitle } from "@/components/ui";
import { requestBooking, decideBooking, cancelBooking, saveResource, toggleResource, deleteResource } from "./actions";

const span = (s: Date, e: Date) => (s.getTime() === e.getTime() ? formatDay(s) : `${formatDay(s)} – ${formatDay(e)}`);
const statusCls: Record<string, string> = { ANGEFRAGT: "bg-sun text-ink", BESTAETIGT: "bg-brand-600 text-white", ABGELEHNT: "bg-poster text-white", STORNIERT: "bg-stone-200 text-stone-700" };
const Badge = ({ s }: { s: string }) => <span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase ${statusCls[s] ?? ""}`}>{BOOKING_LABEL[s as BookingStatus] ?? s}</span>;

function parseMonth(s: string | undefined, fallback: Date) {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  const y = m ? +m[1] : fallback.getUTCFullYear(), mo = m ? +m[2] - 1 : fallback.getUTCMonth();
  return new Date(Date.UTC(y, Math.min(Math.max(mo, 0), 11), 1));
}
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

function ResourceFields({ r }: { r?: { id: number; name: string; kind: string; description: string | null; handover: string | null; needsApproval: boolean } }) {
  return (
    <>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <input name="name" required minLength={2} maxLength={120} defaultValue={r?.name} placeholder="Name, z. B. Bierzeltgarnituren (10 Sets)" className="input" aria-label="Name" />
        <select name="kind" defaultValue={r?.kind ?? "GERAET"} className="input" aria-label="Art">{RESOURCE_KINDS.map((k) => <option key={k} value={k}>{RESOURCE_LABEL[k]}</option>)}</select>
      </div>
      <textarea name="description" rows={2} maxLength={1000} defaultValue={r?.description ?? ""} placeholder="Beschreibung, Hinweise, ggf. Kaution (optional)" className="input" aria-label="Beschreibung" />
      <input name="handover" maxLength={300} defaultValue={r?.handover ?? ""} placeholder="Abholung / Schlüssel, z. B. bei Familie Meier, Dorfstr. 5 (optional)" className="input" aria-label="Abholung" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="needsApproval" defaultChecked={r?.needsApproval ?? true} /> Anfragen muss die Orga bestätigen (sonst sofort gebucht)</label>
    </>
  );
}

export default async function Reservierung({ searchParams }: { searchParams: Promise<{ r?: string; monat?: string; fehler?: string; ok?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const sp = await searchParams;
  const t = today();
  const resources = await db.resource.findMany({ where: orga ? {} : { active: true }, orderBy: [{ active: "desc" }, { sort: "asc" }, { name: "asc" }] });
  const sel = resources.find((r) => r.id === Number(sp.r)) ?? resources.find((r) => r.active);
  const month = parseMonth(sp.monat, t);
  const monthEnd = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  const prev = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)), next = addDays(monthEnd, 1);

  const [monthBookings, mine, pending, upcoming] = await Promise.all([
    sel ? db.booking.findMany({ where: { resourceId: sel.id, status: { in: BLOCKING }, startDate: { lte: monthEnd }, endDate: { gte: month } }, select: { startDate: true, endDate: true, status: true } }) : Promise.resolve([]),
    db.booking.findMany({ where: { personId: me.id, endDate: { gte: addDays(t, -30) } }, orderBy: { startDate: "asc" }, include: { resource: true } }),
    orga ? db.booking.findMany({ where: { status: "ANGEFRAGT" }, orderBy: { startDate: "asc" }, include: { resource: true, person: { select: { name: true, phone: true, email: true } } } }) : Promise.resolve([]),
    orga && sel ? db.booking.findMany({ where: { resourceId: sel.id, status: "BESTAETIGT", endDate: { gte: t } }, orderBy: { startDate: "asc" }, take: 30, include: { person: { select: { name: true } } } }) : Promise.resolve([]),
  ]);
  const occ = occupancy(monthBookings, month, monthEnd);
  const lead = (month.getUTCDay() + 6) % 7; // Montag = 0
  const days = Array.from({ length: monthEnd.getUTCDate() }, (_, i) => addDays(month, i));
  const monthName = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const q = (o: Record<string, string>) => `/reservierung?${new URLSearchParams({ ...(sel ? { r: String(sel.id) } : {}), monat: monthKey(month), ...o })}`;

  return (
    <>
      <PageTitle>Reservieren & Ausleihen</PageTitle>
      <p className="mb-4 text-stone-600">Dorfgemeinschaftshaus, Bierzeltgarnituren, Pavillon & Co. – schau, wann etwas frei ist, und frag es direkt an.</p>
      {sp.fehler && <p role="alert" className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">{sp.fehler}</p>}
      {sp.ok && <p role="status" className="mb-4 rounded bg-brand-50 p-2 text-sm font-semibold text-brand-700">{sp.ok === "bestaetigt" ? "Reserviert! Die Reservierung ist bestätigt." : "Anfrage gesendet – du bekommst Bescheid, sobald die Orga sie bestätigt."}</p>}

      {pending.length > 0 && (
        <section className="card mb-6 !border-sun !shadow-[5px_5px_0_#FFCA01]"><h2 className="mb-2">Offene Anfragen ({pending.length})</h2>
          <ul>{pending.map((b) => (
            <li key={b.id} className="border-t-2 border-stone-200 py-3 first:border-0">
              <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-semibold">{b.resource.name}</span><span className="font-display text-lg font-bold">{span(b.startDate, b.endDate)}{b.timeText ? ` · ${b.timeText}` : ""}</span></div>
              <p className="text-sm text-stone-700">{b.person.name}{b.person.phone ? ` · ${b.person.phone}` : ""}{b.person.email ? ` · ${b.person.email}` : ""}</p>
              <p className="mb-2 whitespace-pre-line text-sm">„{b.purpose}“</p>
              <form className="flex flex-wrap gap-2"><input type="hidden" name="id" value={b.id} />
                <input name="note" maxLength={500} placeholder="Nachricht an die Person (optional)" className="input flex-1 !min-w-[200px]" aria-label="Nachricht" />
                <button formAction={decideBooking.bind(null, "BESTAETIGT")} className="btn">Bestätigen</button>
                <button formAction={decideBooking.bind(null, "ABGELEHNT")} className="btn-danger">Ablehnen</button>
              </form>
            </li>))}</ul>
        </section>
      )}

      {!resources.length && <p className="card mb-6 text-sm text-stone-600">Noch nichts zum Reservieren eingetragen.{orga ? " Lege unten den ersten Raum oder Gegenstand an." : ""}</p>}

      {sel && (
        <>
          <nav aria-label="Gegenstand wählen" className="mb-4 flex flex-wrap gap-2">
            {resources.map((r) => <Link key={r.id} href={`/reservierung?r=${r.id}&monat=${monthKey(month)}`} aria-current={r.id === sel.id ? "page" : undefined}
              className={`rounded-md border-2 px-3 py-2 font-display text-lg font-bold uppercase ${r.id === sel.id ? "border-brand-600 bg-brand-600 text-white" : "border-brand-600 bg-white text-brand-600 hover:bg-brand-50"} ${r.active ? "" : "opacity-60"}`}>{r.kind === "RAUM" ? "🏠 " : "🪑 "}{r.name}{r.active ? "" : " (inaktiv)"}</Link>)}
          </nav>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <section className="card">
              <h2>{sel.name}</h2>
              <p className="text-xs text-stone-500">{RESOURCE_LABEL[sel.kind as keyof typeof RESOURCE_LABEL]} · {sel.needsApproval ? "Anfrage wird von der Orga bestätigt" : "sofort buchbar"}</p>
              {sel.description && <p className="mt-2 whitespace-pre-line text-sm">{sel.description}</p>}
              {sel.handover && <p className="mt-2 text-sm"><span className="font-semibold">Abholung/Schlüssel:</span> {sel.handover}</p>}

              <div className="mt-4 flex items-center justify-between">
                <Link href={q({ monat: monthKey(prev) })} className="btn-light !min-h-[40px] !px-3" aria-label="Voriger Monat">‹</Link>
                <h3 className="font-display text-2xl font-bold uppercase">{monthName}</h3>
                <Link href={q({ monat: monthKey(next) })} className="btn-light !min-h-[40px] !px-3" aria-label="Nächster Monat">›</Link>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-sm" role="grid" aria-label={`Belegung ${monthName}`}>
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div key={w} className="font-semibold text-stone-500">{w}</div>)}
                {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
                {days.map((d) => { const k = toInput(d), s = occ.get(k), past = d < t;
                  return <div key={k} title={s ? BOOKING_LABEL[s] : past ? "" : "frei"}
                    className={`rounded py-2 font-semibold ${s === "BESTAETIGT" ? "bg-poster text-white" : s === "ANGEFRAGT" ? "bg-sun text-ink" : past ? "text-stone-300" : "bg-brand-50 text-brand-700"} ${k === toInput(t) ? "ring-2 ring-ink" : ""}`}>
                    {d.getUTCDate()}<span className="sr-only"> {s ? BOOKING_LABEL[s] : past ? "" : "frei"}</span></div>; })}
              </div>
              <p className="mt-2 flex flex-wrap gap-3 text-xs text-stone-600"><span><span className="inline-block h-3 w-3 rounded bg-brand-50 align-middle ring-1 ring-brand-600" /> frei</span><span><span className="inline-block h-3 w-3 rounded bg-sun align-middle" /> angefragt</span><span><span className="inline-block h-3 w-3 rounded bg-poster align-middle" /> belegt</span></p>
            </section>

            <section className="card">
              <h2 className="mb-2">{sel.active ? "Anfragen" : "Derzeit nicht reservierbar"}</h2>
              {sel.active && (
                <form action={requestBooking} className="space-y-2">
                  <input type="hidden" name="resourceId" value={sel.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label" htmlFor="start">Von</label><input id="start" type="date" name="start" required min={toInput(t)} className="input" /></div>
                    <div><label className="label" htmlFor="end">Bis (optional)</label><input id="end" type="date" name="end" min={toInput(t)} className="input" /></div>
                  </div>
                  <input name="timeText" maxLength={60} placeholder="Uhrzeit, z. B. ab 14 Uhr (optional)" className="input" aria-label="Uhrzeit" />
                  <textarea name="purpose" required minLength={3} maxLength={500} rows={3} placeholder="Wofür? z. B. Geburtstagsfeier, ca. 40 Personen" className="input" aria-label="Zweck" />
                  <p className="text-xs text-stone-500">Ganze Tage, höchstens {MAX_DAYS} am Stück. Andere sehen nur, dass der Tag belegt ist – Name und Zweck sieht nur die Orga.</p>
                  <button className="btn w-full sm:w-auto">{sel.needsApproval ? "Anfrage senden" : "Jetzt reservieren"}</button>
                </form>
              )}
              {orga && upcoming.length > 0 && (
                <div className="mt-4 border-t-2 border-stone-200 pt-3"><h3 className="mb-1 font-semibold">Bestätigte Reservierungen</h3>
                  <ul className="text-sm">{upcoming.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-x-2 border-t border-stone-100 py-1.5 first:border-0">
                      <span className="font-semibold">{span(b.startDate, b.endDate)}</span><span className="text-stone-600">{b.person.name}{b.timeText ? ` · ${b.timeText}` : ""}</span>
                      <form action={cancelBooking} className="ml-auto"><input type="hidden" name="id" value={b.id} /><button className="text-sm font-semibold text-poster hover:underline">Stornieren</button></form>
                    </li>))}</ul></div>
              )}
            </section>
          </div>
        </>
      )}

      <section className="card mb-6"><h2 className="mb-2">Meine Reservierungen</h2>
        {!mine.length && <p className="text-sm text-stone-500">Du hast nichts reserviert.</p>}
        <ul>{mine.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-stone-200 py-2 first:border-0">
            <Badge s={b.status} /><span className="font-semibold">{b.resource.name}</span><span>{span(b.startDate, b.endDate)}{b.timeText ? ` · ${b.timeText}` : ""}</span>
            {b.note && <span className="w-full text-sm text-stone-600">Orga: {b.note}</span>}
            {b.status === "BESTAETIGT" && b.resource.handover && <span className="w-full text-sm text-stone-600">Abholung/Schlüssel: {b.resource.handover}</span>}
            {BLOCKING.includes(b.status as BookingStatus) && b.endDate >= t && <form action={cancelBooking} className="ml-auto"><input type="hidden" name="id" value={b.id} /><button className="btn-light !min-h-[40px]">Stornieren</button></form>}
          </li>))}</ul>
      </section>

      {orga && (
        <section className="card">
          <h2 className="mb-2">Räume & Inventar verwalten</h2>
          <details className="mb-3"><summary className="cursor-pointer font-semibold text-brand-600">+ Neu anlegen</summary>
            <form action={saveResource} className="mt-2 space-y-2"><ResourceFields /><button className="btn">Anlegen</button></form>
          </details>
          <ul>{resources.map((r) => (
            <li key={r.id} className="border-t-2 border-stone-200 py-2">
              <details><summary className="cursor-pointer font-semibold">{r.name} <span className="text-xs font-normal text-stone-500">{RESOURCE_LABEL[r.kind as keyof typeof RESOURCE_LABEL]}{r.active ? "" : " · inaktiv"}</span></summary>
                <form action={saveResource} className="mt-2 space-y-2"><ResourceFields r={r} /><button className="btn">Speichern</button></form>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={toggleResource}><input type="hidden" name="id" value={r.id} /><button className="btn-light">{r.active ? "Deaktivieren" : "Aktivieren"}</button></form>
                  <form action={deleteResource}><input type="hidden" name="id" value={r.id} /><button className="btn-danger">Löschen</button></form>
                </div>
              </details>
            </li>))}</ul>
        </section>
      )}
    </>
  );
}
