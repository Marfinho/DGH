import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { relativeLabel } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { updateTemplate, deleteTemplate, saveTplMilestone, deleteTplMilestone, saveTplTask, deleteTplTask, saveTplArea, deleteTplArea, deleteTplSlot, deleteTplSchedule, deleteTplMaterial } from "../actions";
import { sortSchedule, timeRange } from "@/lib/plan";

export default async function VorlageDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("ORGANISATOR");
  const id = Number((await params).id);
  const t = await db.template.findUnique({ where: { id }, include: { milestones: { orderBy: { offsetDays: "asc" } }, tasks: { orderBy: { offsetDays: "asc" } }, budgetItems: { orderBy: { id: "asc" } }, areas: { orderBy: { sort: "asc" } }, slots: { orderBy: { sort: "asc" } }, schedule: true, material: { orderBy: { sort: "asc" } } } });
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
      <select name="areaId" defaultValue={task?.areaId ?? ""} className="input sm:col-span-3" aria-label="Themengebiet"><option value="">– kein Themengebiet –</option>{t.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input name="description" defaultValue={task?.description ?? ""} placeholder="Notiz" className="input sm:col-span-7" />
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

      <h2 className="mb-2 ">Meilensteine</h2>
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

      <h2 className="mb-2">Themengebiete</h2>
      <div className="card mb-6">
        <ul className="mb-2 flex flex-wrap gap-2">{t.areas.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-1.5 font-semibold">{a.name}
            <form action={deleteTplArea}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="templateId" value={t.id} /><button aria-label={`${a.name} entfernen`} className="text-poster">✕</button></form></li>))}
          {!t.areas.length && <li className="text-sm text-stone-500">Noch keine Themengebiete.</li>}</ul>
        <form action={saveTplArea} className="flex gap-2"><input type="hidden" name="templateId" value={t.id} /><input name="name" required placeholder="z. B. Marketing" className="input flex-1" /><button className="btn">Hinzufügen</button></form>
      </div>

      <h2 className="mb-2">Aufgaben</h2>
      <div className="space-y-3">
        {t.tasks.map((task) => (
          <div key={task.id} className="card flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">{taskForm(task)}<div className="mt-1 text-xs text-stone-500">{relativeLabel(task.offsetDays)}</div></div>
            <form action={deleteTplTask}><input type="hidden" name="id" value={task.id} /><input type="hidden" name="templateId" value={t.id} /><button className="btn-danger">✕</button></form>
          </div>
        ))}
        <div className="card">{taskForm(null)}</div>
      </div>

      {(t.slots.length > 0 || t.schedule.length > 0 || t.material.length > 0) && <p className="mt-6 text-sm text-stone-600">Helfer-Schichten, Ablauf und Material werden bei neuen Veranstaltungen übernommen. Zum Ändern: in einer Veranstaltung anpassen und „Als Vorlage speichern“ – oder hier einzelne Einträge entfernen.</p>}
      {t.slots.length > 0 && (
        <section className="card mt-3"><h2 className="mb-1">Helfer-Schichten</h2>
          <ul className="text-sm">{t.slots.map((s) => <li key={s.id} className="flex items-center gap-2 border-t border-stone-200 py-1.5 first:border-0"><span className="font-semibold">{s.title}</span><span className="text-stone-600">{s.timeText} · {s.capacity} {s.capacity === 1 ? "Platz" : "Plätze"}</span>
            <form action={deleteTplSlot} className="ml-auto"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="templateId" value={t.id} /><button aria-label={`${s.title} entfernen`} className="text-poster">✕</button></form></li>)}</ul></section>
      )}
      {t.schedule.length > 0 && (
        <section className="card mt-3"><h2 className="mb-1">Ablaufplan</h2>
          <ul className="text-sm">{sortSchedule(t.schedule).map((s) => <li key={s.id} className="flex items-center gap-2 border-t border-stone-200 py-1.5 first:border-0"><span className="w-36 shrink-0 text-stone-600">{relativeLabel(s.dayOffset)}{s.time ? `, ${timeRange(s.time, s.endTime)}` : ""}</span><span className="font-semibold">{s.title}</span>{s.isPublic && <span className="rounded bg-sun px-1.5 text-xs font-bold uppercase">Programm</span>}
            <form action={deleteTplSchedule} className="ml-auto"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="templateId" value={t.id} /><button aria-label={`${s.title} entfernen`} className="text-poster">✕</button></form></li>)}</ul></section>
      )}
      {t.material.length > 0 && (
        <section className="card mt-3"><h2 className="mb-1">Material & Einkauf</h2>
          <ul className="text-sm">{t.material.map((m) => <li key={m.id} className="flex items-center gap-2 border-t border-stone-200 py-1.5 first:border-0"><span className="font-semibold">{m.title}</span><span className="text-stone-600">{[m.quantity, m.source].filter(Boolean).join(" · ")}</span>
            <form action={deleteTplMaterial} className="ml-auto"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="templateId" value={t.id} /><button aria-label={`${m.title} entfernen`} className="text-poster">✕</button></form></li>)}</ul></section>
      )}

      {t.budgetItems.length > 0 && (
        <section className="card mt-6"><h2 className="mb-1">Budget-Vorlage</h2>
          <p className="mb-2 text-sm text-stone-600">Wird bei neuen Veranstaltungen als geplante Posten übernommen (Freigaben starten immer neu). Änderungen: in einer Veranstaltung anpassen und „Als Vorlage speichern“.</p>
          <ul className="text-sm">{t.budgetItems.map((b) => <li key={b.id} className="flex justify-between border-t border-stone-200 py-1.5 first:border-0"><span>{b.kind === "AUSGABE" ? "Ausgabe" : "Einnahme"}: {b.title}</span><b>{formatMoney(b.plannedCents)}</b></li>)}</ul></section>
      )}

      <form action={deleteTemplate} className="mt-8"><input type="hidden" name="id" value={t.id} /><button className="btn-danger">Vorlage löschen</button></form>
    </>
  );
}
