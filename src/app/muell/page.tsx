import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { today, formatDay, diffDays } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { deleteWasteType } from "./actions";
import { ImportForm, GenerateForm } from "./forms";

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
      <p className="mt-4 text-sm text-stone-600">Tipp: Im Kalender-Link unter „Mein Profil“ kannst du die Müllabfuhr zu deinem Handy-Kalender hinzufügen.</p>
      {hasRole(me, "ORGANISATOR") && (
        <div className="mt-8 space-y-4"><section className="card"><h2 className="mb-2 ">Termine importieren</h2><ImportForm /></section>
          <section className="card"><h2 className="mb-2 ">Regelmäßigen Rhythmus erzeugen</h2><GenerateForm /></section></div>
      )}
    </>
  );
}
