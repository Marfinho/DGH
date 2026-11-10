import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { today, toInput, formatDay } from "@/lib/dates";
import { EVENT_STATUS, EVENT_LABEL, TASK_STATUS, TASK_LABEL } from "@/lib/constants";
import { StatusBadge, Progress } from "@/components/ui";
import { updateEvent, saveLessons, deleteEvent, saveMilestone, deleteMilestone, saveTask, cycleTaskStatus, deleteTask, saveAsTemplate } from "../actions";

export default async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [ev, people, templates] = await Promise.all([
    db.event.findUnique({ where: { id }, include: { milestones: { orderBy: { dueDate: "asc" } }, tasks: { orderBy: [{ dueDate: "asc" }, { sort: "asc" }], include: { assignee: true } }, log: { orderBy: { createdAt: "desc" }, take: 15 } } }),
    db.person.findMany({ orderBy: { name: "asc" } }),
    db.template.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!ev) notFound();
  const t0 = today();
  type T = (typeof ev.tasks)[number];

  const taskRow = (t: T) => (
    <li key={t.id} className="border-t border-stone-100 py-2 first:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <form action={cycleTaskStatus}><input type="hidden" name="id" value={t.id} /><button title="Status weiterschalten"><StatusBadge status={t.status} /></button></form>
        <span className={`font-medium ${t.status === "ERLEDIGT" ? "text-stone-400 line-through" : ""}`}>{t.title}</span>
        <span className="text-sm text-stone-500">{t.assignee?.name ?? "niemand zugewiesen"}</span>
        <span className={`ml-auto text-sm ${t.status !== "ERLEDIGT" && t.dueDate < t0 ? "font-semibold text-red-700" : "text-stone-600"}`}>{formatDay(t.dueDate)}</span>
      </div>
      <details className="mt-1"><summary className="cursor-pointer text-xs text-brand-600">Bearbeiten</summary>
        {taskForm(t)}
        <form action={deleteTask} className="mt-1"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="eventId" value={ev.id} /><button className="btn-danger">Aufgabe löschen</button></form>
      </details>
    </li>
  );

  const taskForm = (t: T | null, msId?: number) => (
    <form action={saveTask} className="mt-2 grid gap-2 sm:grid-cols-12">
      <input type="hidden" name="eventId" value={ev.id} />{t && <input type="hidden" name="id" value={t.id} />}
      <input name="title" required defaultValue={t?.title} placeholder="Aufgabe" className="input sm:col-span-4" />
      <input name="dueDate" type="date" required defaultValue={t ? toInput(t.dueDate) : toInput(ev.date)} className="input sm:col-span-2" />
      <select name="assigneeId" defaultValue={t?.assigneeId ?? ""} className="input sm:col-span-3"><option value="">– niemand –</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select name="status" defaultValue={t?.status ?? "OFFEN"} className="input sm:col-span-3">{TASK_STATUS.map((s) => <option key={s} value={s}>{TASK_LABEL[s]}</option>)}</select>
      <select name="milestoneId" defaultValue={t?.milestoneId ?? msId ?? ""} className="input sm:col-span-4"><option value="">– kein Meilenstein –</option>{ev.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select>
      <input name="description" defaultValue={t?.description ?? ""} placeholder="Notiz" className="input sm:col-span-5" />
      <button className={`${t ? "btn-light" : "btn"} sm:col-span-3`}>{t ? "Speichern" : "Aufgabe hinzufügen"}</button>
    </form>
  );

  const loose = ev.tasks.filter((t) => !t.milestoneId);
  const done = ev.tasks.filter((t) => t.status === "ERLEDIGT").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{ev.title}</h1><p className="text-stone-600">{formatDay(ev.date)}{ev.location ? ` · ${ev.location}` : ""} · {EVENT_LABEL[ev.status as keyof typeof EVENT_LABEL]}</p></div>
        <Progress done={done} total={ev.tasks.length} />
      </div>

      {ev.milestones.map((m) => {
        const ts = ev.tasks.filter((t) => t.milestoneId === m.id);
        return (
          <section key={m.id} className="card mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">🎯 {m.title} <span className="text-sm font-normal text-stone-500">bis {formatDay(m.dueDate)}</span></h2><Progress done={ts.filter((t) => t.status === "ERLEDIGT").length} total={ts.length} /></div>
            <ul className="mt-2">{ts.map(taskRow)}</ul>
            <details className="mt-2"><summary className="cursor-pointer text-sm text-brand-600">Aufgabe hinzufügen</summary>{taskForm(null, m.id)}</details>
            <details className="mt-1"><summary className="cursor-pointer text-xs text-stone-500">Meilenstein bearbeiten</summary>
              <form action={saveMilestone} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="eventId" value={ev.id} /><input type="hidden" name="id" value={m.id} />
                <input name="title" defaultValue={m.title} required className="input flex-1" /><input name="dueDate" type="date" defaultValue={toInput(m.dueDate)} required className="input w-40" /><button className="btn-light">Speichern</button></form>
              <form action={deleteMilestone} className="mt-1"><input type="hidden" name="id" value={m.id} /><input type="hidden" name="eventId" value={ev.id} /><button className="btn-danger">Meilenstein löschen (Aufgaben bleiben)</button></form>
            </details>
          </section>
        );
      })}

      <section className="card mb-4">
        <h2 className="font-semibold">Aufgaben ohne Meilenstein</h2>
        <ul className="mt-2">{loose.map(taskRow)}</ul>
        <details className="mt-2"><summary className="cursor-pointer text-sm text-brand-600">Aufgabe hinzufügen</summary>{taskForm(null)}</details>
      </section>

      <form action={saveMilestone} className="card mb-8 flex flex-wrap items-end gap-2">
        <input type="hidden" name="eventId" value={ev.id} />
        <div className="flex-1"><label className="label">Neuer Meilenstein</label><input name="title" required className="input" /></div>
        <div><label className="label">Frist</label><input name="dueDate" type="date" required defaultValue={toInput(ev.date)} className="input" /></div>
        <button className="btn">Hinzufügen</button>
      </form>

      <section className="card mb-4">
        <h2 className="mb-2 font-semibold">Lessons Learned</h2>
        <form action={saveLessons}><input type="hidden" name="id" value={ev.id} />
          <textarea name="lessonsLearned" rows={5} defaultValue={ev.lessonsLearned ?? ""} placeholder="Was lief gut? Was machen wir nächstes Mal anders?" className="input" />
          <button className="btn mt-2">Speichern</button></form>
      </section>

      <section className="card mb-4">
        <h2 className="mb-2 font-semibold">Als Vorlage speichern</h2>
        <p className="mb-2 text-sm text-stone-600">Übernimmt Meilensteine und Aufgaben in der jetzigen Form; Fristen werden wieder relativ zum Veranstaltungstag gespeichert.</p>
        <form action={saveAsTemplate} className="flex flex-wrap items-end gap-2"><input type="hidden" name="eventId" value={ev.id} />
          <div><label className="label">Bestehende Vorlage überschreiben</label><select name="templateId" defaultValue={ev.templateId ?? ""} className="input"><option value="">– neue Vorlage –</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div><label className="label">Name der neuen Vorlage</label><input name="newName" defaultValue={ev.title} className="input" /></div>
          <button className="btn">Speichern</button></form>
      </section>

      <details className="card mb-4"><summary className="cursor-pointer font-semibold">Veranstaltung bearbeiten</summary>
        <form action={updateEvent} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="id" value={ev.id} />
          <div><label className="label">Titel</label><input name="title" defaultValue={ev.title} required className="input" /></div>
          <div><label className="label">Datum</label><input name="date" type="date" defaultValue={toInput(ev.date)} required className="input" /></div>
          <div><label className="label">Ort</label><input name="location" defaultValue={ev.location ?? ""} className="input" /></div>
          <div><label className="label">Status</label><select name="status" defaultValue={ev.status} className="input">{EVENT_STATUS.map((s) => <option key={s} value={s}>{EVENT_LABEL[s]}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label">Beschreibung</label><textarea name="description" defaultValue={ev.description ?? ""} rows={2} className="input" /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="shift" /> Bei Datumsänderung alle Fristen mitverschieben</label>
          <button className="btn w-fit">Speichern</button></form>
        <form action={deleteEvent} className="mt-4"><input type="hidden" name="id" value={ev.id} /><button className="btn-danger">Veranstaltung löschen</button></form>
      </details>

      <section className="card"><h2 className="mb-2 font-semibold">Änderungsprotokoll</h2>
        <ul className="space-y-1 text-sm text-stone-600">{ev.log.map((l) => <li key={l.id}><span className="text-stone-400">{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(l.createdAt)}</span> {l.text}</li>)}</ul></section>
    </>
  );
}
