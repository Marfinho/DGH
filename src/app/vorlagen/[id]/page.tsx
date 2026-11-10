import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { relativeLabel } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { updateTemplate, deleteTemplate, saveTplMilestone, deleteTplMilestone, saveTplTask, deleteTplTask } from "../actions";

export default async function VorlageDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("ORGANISATOR");
  const id = Number((await params).id);
  const t = await db.template.findUnique({ where: { id }, include: { milestones: { orderBy: { offsetDays: "asc" } }, tasks: { orderBy: { offsetDays: "asc" } } } });
  if (!t) notFound();

  const taskForm = (task: (typeof t.tasks)[number] | null) => (
    <form action={saveTplTask} className="grid gap-2 sm:grid-cols-12">
      <input type="hidden" name="templateId" value={t.id} />
      {task && <input type="hidden" name="id" value={task.id} />}
      <input name="title" required defaultValue={task?.title} placeholder="Aufgabe" className="input sm:col-span-4" />
      <input name="offsetDays" type="number" required defaultValue={task?.offsetDays ?? -14} title="Tage relativ zum Veranstaltungstag (negativ = davor)" className="input sm:col-span-2" />
      <select name="milestoneId" defaultValue={task?.milestoneId ?? ""} className="input sm:col-span-3">
        <option value="">– kein Meilenstein –</option>
        {t.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
      <input name="description" defaultValue={task?.description ?? ""} placeholder="Notiz" className="input sm:col-span-3" />
      <button className={`${task ? "btn-light" : "btn"} sm:col-span-2`}>{task ? "Speichern" : "Aufgabe hinzufügen"}</button>
    </form>
  );

  return (
    <>
      <PageTitle>Vorlage: {t.name}</PageTitle>
      <form action={updateTemplate} className="card mb-4 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="id" value={t.id} />
        <div><label className="label">Name</label><input name="name" defaultValue={t.name} required className="input" /></div>
        <div className="sm:col-span-2"><label className="label">Beschreibung</label><input name="description" defaultValue={t.description ?? ""} className="input" /></div>
        <button className="btn-light w-fit">Speichern</button>
      </form>
      <p className="mb-4 text-sm text-stone-600">Tage sind relativ zum Veranstaltungstag: <b>−60</b> = 60 Tage vorher, <b>0</b> = am Tag selbst, <b>3</b> = 3 Tage danach.</p>

      <h2 className="mb-2 font-semibold">Meilensteine</h2>
      <div className="card mb-6 space-y-2">
        {t.milestones.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2">
            <form action={saveTplMilestone} className="flex flex-1 flex-wrap gap-2">
              <input type="hidden" name="templateId" value={t.id} /><input type="hidden" name="id" value={m.id} />
              <input name="title" defaultValue={m.title} required className="input flex-1" />
              <input name="offsetDays" type="number" defaultValue={m.offsetDays} required className="input w-24" />
              <span className="self-center text-xs text-stone-500">{relativeLabel(m.offsetDays)}</span>
              <button className="btn-light">Speichern</button>
            </form>
            <form action={deleteTplMilestone}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="templateId" value={t.id} /><button className="btn-danger">✕</button></form>
          </div>
        ))}
        <form action={saveTplMilestone} className="flex flex-wrap gap-2 border-t border-stone-100 pt-2">
          <input type="hidden" name="templateId" value={t.id} />
          <input name="title" required placeholder="Neuer Meilenstein" className="input flex-1" />
          <input name="offsetDays" type="number" required defaultValue={-30} className="input w-24" />
          <button className="btn">Hinzufügen</button>
        </form>
      </div>

      <h2 className="mb-2 font-semibold">Aufgaben</h2>
      <div className="space-y-3">
        {t.tasks.map((task) => (
          <div key={task.id} className="card flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">{taskForm(task)}<div className="mt-1 text-xs text-stone-500">{relativeLabel(task.offsetDays)}</div></div>
            <form action={deleteTplTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="templateId" value={t.id} /><button className="btn-danger">✕</button></form>
          </div>
        ))}
        <div className="card">{taskForm(null)}</div>
      </div>

      <form action={deleteTemplate} className="mt-8"><input type="hidden" name="id" value={t.id} /><button className="btn-danger">Vorlage löschen</button></form>
    </>
  );
}
