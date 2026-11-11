import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { createTemplate, installStandard } from "./actions";
import { STANDARD_TEMPLATES } from "@/lib/standard-templates";

export default async function Vorlagen({ searchParams }: { searchParams: Promise<{ neu?: string }> }) {
  await requireUser("ORGANISATOR");
  const { neu } = await searchParams;
  const list = await db.template.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tasks: true, milestones: true, slots: true, schedule: true, material: true } } } });
  const missing = STANDARD_TEMPLATES.filter((s) => !list.some((t) => t.name === s.name));
  return (
    <>
      <PageTitle>Vorlagen</PageTitle>
      {neu !== undefined && <p role="status" className="mb-4 rounded bg-brand-50 p-2 text-sm font-semibold text-brand-700">{neu ? `Angelegt: ${neu}. Bitte vor dem ersten Einsatz durchsehen und an eure Gemeinde anpassen.` : "Alle fertigen Vorlagen sind schon vorhanden."}</p>}
      {missing.length > 0 && (
        <form action={installStandard} className="card mb-6 !border-sun !shadow-[5px_5px_0_#FFCA01]">
          <h2 className="mb-1">Fertige Vorlagen</h2>
          <p className="mb-3 text-sm text-stone-700">Ausgearbeitete Planungen mit Aufgaben, Fristen, Themengebieten, Helfer-Schichten, Ablaufplan, Materialliste und Budget-Rahmen. Sie sind ein Startpunkt: Genehmigungen und Fristen unterscheiden sich je nach Gemeinde – bitte anpassen.</p>
          <ul className="mb-3 space-y-2">{missing.map((s) => (
            <li key={s.name}><label className="flex items-start gap-2"><input type="checkbox" name="name" value={s.name} defaultChecked className="mt-1 h-5 w-5" />
              <span><span className="font-semibold">{s.name}</span> <span className="text-sm text-stone-600">– {s.tasks.length} Aufgaben, {s.slots.length} Schichten, {s.schedule.length} Programmpunkte, {s.material.length} Material-Posten</span><span className="block text-sm text-stone-600">{s.description}</span></span></label></li>))}
          </ul>
          <button className="btn">Ausgewählte anlegen</button>
        </form>
      )}
      <form action={createTemplate} className="card mb-6 flex items-end gap-3">
        <div className="flex-1"><label className="label">Neue leere Vorlage</label><input name="name" required placeholder="z. B. Sommerfest" className="input" /></div>
        <button className="btn">Anlegen</button>
      </form>
      <ul className="space-y-2">
        {list.map((t) => (
          <li key={t.id}><Link href={`/vorlagen/${t.id}`} className="card block hover:border-brand-600">
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-stone-600">{t._count.milestones} Meilensteine · {t._count.tasks} Aufgaben{t._count.slots ? ` · ${t._count.slots} Schichten` : ""}{t._count.schedule ? ` · ${t._count.schedule} Programmpunkte` : ""}{t._count.material ? ` · ${t._count.material} Material` : ""}</div>
          </Link></li>
        ))}
        {!list.length && <li className="text-sm text-stone-500">Noch keine Vorlagen. Du kannst auch eine Veranstaltung nach dem Event als Vorlage speichern.</li>}
      </ul>
    </>
  );
}
