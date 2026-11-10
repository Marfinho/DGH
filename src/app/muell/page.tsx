import { db } from "@/lib/db";
import { requireUser, hasRole, appUrl } from "@/lib/auth";
import { today, formatDay, diffDays } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { deleteWasteType } from "./actions";
import { ImportForm, GenerateForm, IcsForm } from "./forms";

export default async function Muell() {
  const me = await requireUser();
  const t = today();
  const dates = await db.wasteDate.findMany({ where: { date: { gte: t } }, orderBy: { date: "asc" } });
  const types = [...new Set(dates.map((d) => d.type))].sort();
  return (
    <>
      <PageTitle>Müllkalender</PageTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {types.map((ty) => {
          const next = dates.filter((d) => d.type === ty).slice(0, 4);
          const n = diffDays(next[0].date, t);
          return (
            <section key={ty} className="card"><h2>🗑 {ty}</h2>
              <p className="text-sm text-brand-700">{n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`}</p>
              <ul className="mt-1 text-sm text-stone-700">{next.map((d) => <li key={d.id}>{formatDay(d.date)}</li>)}</ul>
              {hasRole(me, "ORGANISATOR") && <form action={deleteWasteType} className="mt-2"><input type="hidden" name="type" value={ty} /><button className="text-xs text-poster hover:underline">zukünftige Termine löschen</button></form>}
            </section>
          );
        })}
      </div>
      {!types.length && <p className="text-sm text-stone-500">Noch keine Termine hinterlegt.</p>}
      {types.length > 0 && (() => { const base = appUrl(); const web = base.replace(/^https?:\/\//, "webcal://"); const link = (extra = "") => `/muell.ics${extra ? `?${extra}` : ""}`;
        return (
        <section className="card mt-6"><h2 className="mb-1">In den Handy-Kalender übernehmen</h2>
          <p className="mb-3 text-sm text-stone-600">Als Abo bleibt der Kalender automatisch aktuell. Funktioniert mit iPhone, Android (Google Kalender), Outlook und Thunderbird – ohne Anmeldung.</p>
          <div className="flex flex-wrap gap-2">
            <a href={`${web}/muell.ics`} className="btn">📅 Kalender abonnieren</a>
            <a href={`${web}/muell.ics?erinnerung=1`} className="btn-sun">🔔 Abo mit Erinnerung am Vorabend</a>
            <a href={link("dl=1")} className="btn-light">Als .ics-Datei herunterladen</a>
          </div>
          <details className="mt-3"><summary className="text-sm font-semibold text-brand-600">Nur bestimmte Tonnen / Adresse zum Kopieren</summary>
            <p className="mt-2 text-sm">Alle: <input readOnly className="input !inline-block !w-full font-mono text-xs" value={`${base}/muell.ics`} /></p>
            <ul className="mt-2 space-y-1 text-sm">{types.map((ty) => <li key={ty} className="flex flex-wrap items-center gap-2"><b>{ty}</b> <a className="font-semibold text-brand-600 underline" href={`${web}/muell.ics?art=${encodeURIComponent(ty)}`}>abonnieren</a> · <a className="font-semibold text-brand-600 underline" href={link(`art=${encodeURIComponent(ty)}&dl=1`)}>.ics laden</a></li>)}</ul>
            <p className="mt-2 text-xs text-stone-500">Android/Google Kalender: „Weitere Kalender → Per URL“ und die Adresse oben einfügen (statt <code>webcal://</code> mit <code>https://</code>).</p></details>
        </section>); })()}
      <p className="mt-4 text-sm text-stone-600">Tipp: Im Kalender-Link unter „Mein Profil“ kannst du die Müllabfuhr zu deinem Handy-Kalender hinzufügen.</p>
      {hasRole(me, "ORGANISATOR") && (
        <div className="mt-8 space-y-4"><section className="card"><h2 className="mb-2 ">Termine importieren</h2><ImportForm /></section>
          <section className="card"><h2 className="mb-2">Aus Kalenderdatei (.ics) importieren</h2><IcsForm /></section>
          <section className="card"><h2 className="mb-2">Regelmäßigen Rhythmus erzeugen</h2><GenerateForm /></section></div>
      )}
    </>
  );
}
