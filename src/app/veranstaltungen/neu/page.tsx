import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { createEvent } from "../actions";

export default async function Neu() {
  const templates = await db.template.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageTitle>Neue Veranstaltung</PageTitle>
      <form action={createEvent} className="card grid max-w-xl gap-3">
        <div><label className="label">Vorlage</label>
          <select name="templateId" className="input"><option value="">– leer starten –</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="label">Titel *</label><input name="title" required placeholder="z. B. Dorffest 2027" className="input" /></div>
        <div><label className="label">Veranstaltungstag *</label><input name="date" type="date" required className="input" /></div>
        <div><label className="label">Ort</label><input name="location" className="input" /></div>
        <p className="text-sm text-stone-600">Alle Fristen der Vorlage werden aus dem Veranstaltungstag berechnet und können danach einzeln angepasst werden.</p>
        <button className="btn w-fit">Veranstaltung anlegen</button>
      </form>
    </>
  );
}
