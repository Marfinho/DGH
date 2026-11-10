import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { savePerson, deletePerson } from "./actions";

export default async function Personen() {
  const people = await db.person.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tasks: true } } } });
  return (
    <>
      <PageTitle>Personen</PageTitle>
      <p className="mb-4 text-sm text-stone-600">Zuständige für Aufgaben. Kontaktdaten sind freiwillig und werden nur für die Planung verwendet. Löschen entfernt die Person vollständig; ihre Aufgaben bleiben ohne Zuständigen bestehen.</p>
      <form action={savePerson} className="card mb-6 grid gap-3 sm:grid-cols-4">
        <div><label className="label">Name *</label><input name="name" required className="input" /></div>
        <div><label className="label">E-Mail</label><input name="email" type="email" className="input" /></div>
        <div><label className="label">Telefon</label><input name="phone" className="input" /></div>
        <div className="flex items-end"><button className="btn">Hinzufügen</button></div>
      </form>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id} className="card flex flex-wrap items-end gap-3">
            <form action={savePerson} className="grid flex-1 gap-2 sm:grid-cols-4">
              <input type="hidden" name="id" value={p.id} />
              <input name="name" defaultValue={p.name} required className="input" />
              <input name="email" defaultValue={p.email ?? ""} type="email" placeholder="E-Mail" className="input" />
              <input name="phone" defaultValue={p.phone ?? ""} placeholder="Telefon" className="input" />
              <button className="btn-light">Speichern</button>
            </form>
            <form action={deletePerson}><input type="hidden" name="id" value={p.id} /><button className="btn-danger">Löschen ({p._count.tasks} Aufg.)</button></form>
          </li>
        ))}
        {!people.length && <li className="text-sm text-stone-500">Noch keine Personen angelegt.</li>}
      </ul>
    </>
  );
}
