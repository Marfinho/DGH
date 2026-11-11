import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { setRsvp, joinSlot, leaveSlot } from "../mitmachen";
import { budgetAccess } from "@/lib/budget-access";
import { canManageGroup } from "@/lib/group-access";
import { formatSize } from "@/lib/files";
import { uploadFile, deleteFile, toggleVisible } from "../dateien";
import { summarize } from "@/lib/budget";
import { formatMoney } from "@/lib/money";
import { today, toInput, formatDay } from "@/lib/dates";
import { pushEnabled } from "@/lib/push";
import { EVENT_STATUS, EVENT_LABEL, TASK_STATUS, TASK_LABEL } from "@/lib/constants";
import { StatusBadge, Progress, EventHero, OverdueBadge } from "@/components/ui";
import { AutoSelect } from "@/components/auto-select";
import { EventTabs } from "@/components/event-tabs";
import { groupByDay, dayHeading, timeRange, materialSummary } from "@/lib/plan";
import { quickAssign, updateEvent, saveArea, deleteArea, seedAreas, saveSlot, deleteSlot, saveLessons, deleteEvent, saveMilestone, deleteMilestone, saveTask, cycleTaskStatus, deleteTask, saveAsTemplate } from "../actions";

export default async function EventDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gebiet?: string; datei?: string; fehler?: string; ansicht?: string }> }) {
  const me = await requireUser();
  const { gebiet, datei, fehler, ansicht } = await searchParams;
  const id = Number((await params).id);
  const [ev, people, templates] = await Promise.all([
    db.event.findUnique({ where: { id }, include: { group: true, slots: { orderBy: { id: "asc" }, include: { signups: { include: { person: true } } } }, rsvps: { include: { person: true } }, attachments: { where: { budgetItemId: null }, orderBy: { createdAt: "desc" }, include: { uploadedBy: true } }, milestones: { orderBy: { dueDate: "asc" } }, areas: { orderBy: [{ sort: "asc" }, { name: "asc" }], include: { lead: true } }, tasks: { orderBy: [{ dueDate: "asc" }, { sort: "asc" }], include: { assignee: true, area: true } }, log: { orderBy: { createdAt: "desc" }, take: 15 } } }),
    db.person.findMany({ orderBy: { name: "asc" } }),
    db.template.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!ev) notFound();
  const acc = await budgetAccess(id, me);
  const bItems = acc.view ? await db.budgetItem.findMany({ where: { eventId: id }, select: { kind: true, plannedCents: true, actualCents: true, status: true } }) : [];
  const bs = summarize(bItems, ev.budgetCents);
  const pending = bItems.filter((i) => i.status === "BEANTRAGT").length;
  const budgetCard = acc.view && (
    <section className="card mb-4">
      <h2 className="mb-1">Budget &amp; Freigaben</h2>
      <p className="text-sm text-stone-700">Erwartete Ausgaben <b>{formatMoney(bs.expectedExpense)}</b>{ev.budgetCents != null && <> von {formatMoney(ev.budgetCents)}</>} · Ergebnis (Prognose) <b>{formatMoney(bs.result)}</b>{pending > 0 && <> · <b className="text-poster">{pending} wartet auf Freigabe</b></>}</p>
      {bs.over && <p className="text-sm font-bold text-poster">Budgetrahmen überschritten</p>}
      <Link href={`/veranstaltungen/${id}/budget`} className="btn mt-2">Budget öffnen</Link>
    </section>
  );
  const isOrga = hasRole(me, "ORGANISATOR");
  // Bürgeransicht: Orga sieht die Seite wie Bewohner (und kann selbst zusagen/sich eintragen)
  if (!isOrga || ansicht === "buerger") {
    const isVorstand = ev.groupId ? await canManageGroup(ev.groupId, me) : false;
    if (!isOrga && !acc.isFreigeber && !isVorstand && (!ev.published || ev.status === "ARCHIVIERT")) notFound();
    const mine = ev.rsvps.find((r) => r.personId === me.id);
    const yes = ev.rsvps.filter((r) => r.status === "JA");
    // Programm: nur öffentliche Punkte einer veröffentlichten Veranstaltung
    const programm = groupByDay(await db.scheduleItem.findMany({ where: { eventId: id, isPublic: true, ...(isOrga ? {} : { event: { published: true } }) }, select: { id: true, dayOffset: true, time: true, endTime: true, title: true, place: true } }));
    return (
      <>
        {isOrga && (
          <p role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-sun p-3 text-sm font-semibold">
            <span>👁 Bürgeransicht – so sehen Bewohner diese Seite.{!ev.published ? " Achtung: noch Entwurf, Bewohner sehen sie noch gar nicht." : ""}</span>
            <Link href={`/veranstaltungen/${id}`} className="btn-light ml-auto !min-h-[36px]">Zurück zur Planung</Link>
          </p>
        )}
        <EventHero kicker={`${formatDay(ev.date)}${ev.location ? ` · ${ev.location}` : ""}${ev.group ? ` · ${ev.group.name}` : ""}`} title={ev.title} />
        {ev.description && <p className="card mb-4 whitespace-pre-line">{ev.description}</p>}
        {programm.length > 0 && (
          <section className="card mb-4"><h2 className="mb-2">Programm</h2>
            {programm.map((g) => (
              <div key={g.dayOffset} className="mb-2 last:mb-0">
                {programm.length > 1 && <h3 className="font-display text-lg font-bold uppercase text-stone-600">{dayHeading(ev.date, g.dayOffset).split(" · ")[0]}</h3>}
                <ol>{g.items.map((it) => <li key={it.id} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-3 border-t-2 border-stone-200 py-1.5 first:border-0 sm:grid-cols-[7rem_1fr]"><span className="font-display text-xl font-bold text-brand-600">{timeRange(it.time, it.endTime) || "ganztags"}</span><span><span className="font-semibold">{it.title}</span>{it.place && <span className="block text-sm text-stone-600">{it.place}</span>}</span></li>)}</ol>
              </div>
            ))}
          </section>
        )}
        {budgetCard}
        {ev.attachments.filter((a) => a.visible).length > 0 && ev.published && (
          <section className="card mb-4"><h2 className="mb-2">Unterlagen</h2>
            <ul>{ev.attachments.filter((a) => a.visible).map((a) => <li key={a.id} className="border-t-2 border-stone-200 py-2 first:border-0"><a href={`/api/files/${a.id}`} className="font-semibold text-brand-600 underline">{a.name}</a> <span className="text-sm text-stone-500">({formatSize(a.size)})</span></li>)}</ul></section>
        )}
        <section className="card mb-4">
          <h2 className="mb-2">Kommst du?</h2>
          <form className="flex flex-wrap items-end gap-2"><input type="hidden" name="eventId" value={ev.id} />
            <div><label className="label">Weitere Personen (ohne dich)</label><input name="guests" type="number" min={0} max={20} defaultValue={mine?.guests ?? 0} className="input w-24" /></div>
            {(["JA", "VIELLEICHT", "NEIN"] as const).map((st) => <button key={st} formAction={setRsvp.bind(null, st)} className={mine?.status === st ? "btn" : "btn-light"}>{st === "JA" ? "Ich komme" : st === "NEIN" ? "Ich kann nicht" : "Vielleicht"}</button>)}
          </form>
          <p className="mt-2 text-xs text-stone-500">{yes.length + yes.reduce((a, r) => a + r.guests, 0)} Personen haben bisher zugesagt.</p>
        </section>
        {ev.slots.length > 0 && (
          <section className="card mb-4"><h2 className="mb-2">Helfer gesucht</h2>
            <ul>{ev.slots.map((sl) => { const joined = sl.signups.some((x) => x.personId === me.id); const full = sl.signups.length >= sl.capacity; return (
              <li key={sl.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-2 first:border-0">
                <div className="min-w-0 flex-1"><div className="font-medium">{sl.title}{sl.timeText ? <span className="font-normal text-stone-600"> · {sl.timeText}</span> : null}</div>{sl.description && <div className="text-sm text-stone-600">{sl.description}</div>}<div className="text-xs text-stone-500">{sl.signups.length} von {sl.capacity} Plätzen vergeben</div></div>
                {joined ? <form action={leaveSlot}><input type="hidden" name="slotId" value={sl.id} /><button className="btn-light">Austragen</button></form>
                  : full ? <span className="text-sm text-stone-500">voll</span>
                  : <form action={joinSlot}><input type="hidden" name="slotId" value={sl.id} /><button className="btn">Eintragen</button></form>}
              </li>); })}</ul></section>
        )}
      </>
    );
  }
  const t0 = today();
  type T = (typeof ev.tasks)[number];

  const taskRow = (t: T) => (
    <li key={t.id} className="border-t border-stone-100 py-2 first:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <form action={cycleTaskStatus}><input type="hidden" name="id" value={t.id} /><button title="Status weiterschalten"><StatusBadge status={t.status} /></button></form>
        <span className={`font-medium ${t.status === "ERLEDIGT" ? "text-stone-400 line-through" : ""}`}>{t.title}</span>
        {t.area && <span className="rounded border-2 border-stone-300 px-1.5 text-xs font-bold uppercase text-stone-600">{t.area.name}</span>}
        <AutoSelect action={quickAssign} name="assigneeId" value={t.assigneeId ?? ""} hidden={{ id: t.id }} label={`Zuständig für ${t.title}`} options={[{ value: "", label: "– niemand –" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
        {t.status !== "ERLEDIGT" && t.dueDate < t0 && <OverdueBadge />}<span className={`ml-auto text-sm ${t.status !== "ERLEDIGT" && t.dueDate < t0 ? "font-bold text-poster" : "text-stone-600"}`}>{formatDay(t.dueDate)}</span>
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
      <select name="areaId" defaultValue={t?.areaId ?? (filterId || "")} className="input sm:col-span-4" aria-label="Themengebiet"><option value="">– kein Themengebiet –</option>{ev.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input name="description" defaultValue={t?.description ?? ""} placeholder="Notiz" className="input sm:col-span-5" />
      <button className={`${t ? "btn-light" : "btn"} sm:col-span-3`}>{t ? "Speichern" : "Aufgabe hinzufügen"}</button>
    </form>
  );

  const filterId = gebiet === "keins" ? 0 : Number(gebiet) || null; // 0 = ohne Themengebiet
  const shown = ev.tasks.filter((t) => (filterId === null ? true : filterId === 0 ? !t.areaId : t.areaId === filterId));
  const loose = shown.filter((t) => !t.milestoneId);
  const chip = (href: string, label: string, active: boolean, count?: string) => (
    <Link key={href} href={href} aria-current={active ? "true" : undefined} className={`rounded-md border-2 px-3 py-1.5 font-display text-base font-bold uppercase tracking-wide ${active ? "border-brand-600 bg-brand-600 text-white" : "border-brand-600 text-brand-600 hover:bg-brand-50"}`}>{label}{count && <span className="ml-1.5 opacity-80">{count}</span>}</Link>
  );
  const done = ev.tasks.filter((t) => t.status === "ERLEDIGT").length;
  const [schedCount, mat] = await Promise.all([db.scheduleItem.count({ where: { eventId: id } }), db.materialItem.findMany({ where: { eventId: id }, select: { status: true } })]);
  const plan = { schedule: schedCount, material: materialSummary(mat) };

  return (
    <>
      <EventHero kicker={`${formatDay(ev.date)}${ev.location ? ` · ${ev.location}` : ""} · ${EVENT_LABEL[ev.status as keyof typeof EVENT_LABEL]}${ev.published ? " · veröffentlicht" : " · Entwurf"}`} title={ev.title}
        right={<Progress onDark done={done} total={ev.tasks.length} />} />
      <p className="-mt-2 mb-3 text-right text-sm"><Link href={`/veranstaltungen/${id}?ansicht=buerger`} className="font-semibold text-brand-600 hover:underline">👁 Bürgeransicht</Link></p>
      <EventTabs id={id} active="aufgaben" counts={{ aufgaben: `${done}/${ev.tasks.length}`, ablauf: plan.schedule ? String(plan.schedule) : undefined, material: plan.material.total ? `${plan.material.done}/${plan.material.total}` : undefined }} />

      {fehler === "gebiet" && <p role="alert" className="mb-4 rounded-md bg-sun p-3 font-semibold">Ein Themengebiet mit diesem Namen gibt es schon.</p>}
      <nav aria-label="Themengebiete" className="mb-4 flex flex-wrap items-center gap-2">
        {chip(`/veranstaltungen/${id}`, "Alle", filterId === null, `${ev.tasks.length}`)}
        {ev.areas.map((a) => { const n = ev.tasks.filter((t) => t.areaId === a.id); return chip(`/veranstaltungen/${id}?gebiet=${a.id}`, a.name, filterId === a.id, `${n.filter((t) => t.status === "ERLEDIGT").length}/${n.length}`); })}
        {ev.areas.length > 0 && ev.tasks.some((t) => !t.areaId) && chip(`/veranstaltungen/${id}?gebiet=keins`, "Ohne Gebiet", filterId === 0, `${ev.tasks.filter((t) => !t.areaId).length}`)}
      </nav>
      <details className="card mb-4 !p-3"><summary className="font-display text-xl font-extrabold uppercase text-brand-600">+ Aufgabe schnell anlegen</summary>{taskForm(null)}</details>
      {filterId !== null && filterId > 0 && (() => { const a = ev.areas.find((x) => x.id === filterId); return a ? <p className="mb-4 rounded-md bg-brand-50 p-3 text-sm font-semibold">Themengebiet <b>{a.name}</b> · Leitung: {a.lead?.name ?? "noch nicht festgelegt"}</p> : null; })()}

      {ev.milestones.map((m) => {
        const ts = shown.filter((t) => t.milestoneId === m.id);
        return (
          <section key={m.id} className="card mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2>🎯 {m.title} <span className="text-sm font-normal text-stone-500">bis {formatDay(m.dueDate)}</span></h2><Progress done={ts.filter((t) => t.status === "ERLEDIGT").length} total={ts.length} /></div>
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
        <h2>Aufgaben ohne Meilenstein</h2>
        <ul className="mt-2">{loose.map(taskRow)}</ul>
        <details className="mt-2"><summary className="cursor-pointer text-sm text-brand-600">Aufgabe hinzufügen</summary>{taskForm(null)}</details>
      </section>

      <form action={saveMilestone} className="card mb-8 flex flex-wrap items-end gap-2">
        <input type="hidden" name="eventId" value={ev.id} />
        <div className="flex-1"><label className="label">Neuer Meilenstein</label><input name="title" required className="input" /></div>
        <div><label className="label">Frist</label><input name="dueDate" type="date" required defaultValue={toInput(ev.date)} className="input" /></div>
        <button className="btn">Hinzufügen</button>
      </form>

      {budgetCard}
      <details className="card mb-4" open={ev.areas.length === 0}><summary className="font-display text-2xl font-extrabold uppercase text-brand-600">Themengebiete ({ev.areas.length})</summary>
        <p className="my-2 text-sm text-stone-600">Gliedere die Veranstaltung in Bereiche wie Marketing, Technik oder Verpflegung. Aufgaben und Budgetposten lassen sich je Themengebiet zuordnen; jedes Gebiet kann eine Leitung haben.</p>
        <ul className="mb-3">{ev.areas.map((a) => (
          <li key={a.id} className="border-t-2 border-stone-200 py-2 first:border-0">
            <form action={saveArea} className="flex flex-wrap items-center gap-2"><input type="hidden" name="eventId" value={ev.id} /><input type="hidden" name="id" value={a.id} />
              <input name="name" defaultValue={a.name} required className="input min-w-[10rem] flex-1" aria-label="Name" />
              <select name="leadId" defaultValue={a.leadId ?? ""} className="input min-w-[10rem] flex-1" aria-label="Leitung"><option value="">– keine Leitung –</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button className="btn-light">Speichern</button>
              <button formAction={deleteArea} className="btn-danger" aria-label={`${a.name} löschen`}>✕</button></form>
          </li>))}</ul>
        <form action={saveArea} className="flex flex-wrap items-end gap-2"><input type="hidden" name="eventId" value={ev.id} />
          <div className="min-w-[10rem] flex-1"><label className="label">Neues Themengebiet</label><input name="name" required placeholder="z. B. Marketing" className="input" /></div>
          <button className="btn">Hinzufügen</button>
          {ev.areas.length === 0 && <button formAction={seedAreas} className="btn-light">Standard-Gebiete anlegen</button>}</form>
      </details>
      <section className="card mb-4">
        <h2 className="mb-2">Dateien</h2>
        {datei && <p role="alert" className="mb-2 rounded-md bg-sun p-2 text-sm font-semibold">{datei}</p>}
        <ul className="mb-3">{ev.attachments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-stone-200 py-2 first:border-0">
            <a href={`/api/files/${a.id}`} className="font-semibold text-brand-600 underline">{a.name}</a>
            <span className="text-sm text-stone-500">{formatSize(a.size)}{a.uploadedBy ? ` · ${a.uploadedBy.name}` : ""}</span>
            <span className="ml-auto flex items-center gap-2">
              <form action={toggleVisible}><input type="hidden" name="id" value={a.id} /><button className={a.visible ? "rounded bg-brand-600 px-2 py-1 text-sm font-bold text-white" : "rounded border-2 border-stone-300 px-2 py-1 text-sm font-bold text-stone-600"}>{a.visible ? "Für Bewohner sichtbar" : "Nur Orga"}</button></form>
              <form action={deleteFile}><input type="hidden" name="id" value={a.id} /><button className="btn-danger !min-h-[36px] !px-2 !text-base" aria-label={`${a.name} löschen`}>✕</button></form></span>
          </li>))}{!ev.attachments.length && <li className="text-sm text-stone-500">Noch keine Dateien (z. B. Genehmigungen, Programmflyer, Pläne).</li>}</ul>
        <form action={uploadFile} className="flex flex-wrap items-end gap-2"><input type="hidden" name="eventId" value={ev.id} />
          <div className="min-w-[12rem] flex-1"><label className="label">Datei (PDF, Bild, Word/Excel – max. 10 MB)</label><input type="file" name="file" required className="input !p-1.5" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.odt,.ods,.txt,.csv" /></div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" name="visible" className="h-5 w-5" /> Für Bewohner sichtbar</label>
          <button className="btn">Hochladen</button></form>
      </section>
      <section className="card mb-4">
        <h2 className="mb-2">Helfer-Slots</h2>
        <ul className="mb-3">{ev.slots.map((sl) => (
          <li key={sl.id} className="border-t border-stone-100 py-2 first:border-0">
            <div className="font-medium">{sl.title}{sl.timeText ? <span className="font-normal text-stone-600"> · {sl.timeText}</span> : null} <span className="text-sm font-normal text-stone-500">({sl.signups.length}/{sl.capacity}: {sl.signups.map((x) => x.person.name).join(", ") || "noch niemand"})</span></div>
            <details><summary className="cursor-pointer text-xs text-brand-600">Bearbeiten</summary>
              <form action={saveSlot} className="mt-2 grid gap-2 sm:grid-cols-12"><input type="hidden" name="eventId" value={ev.id} /><input type="hidden" name="id" value={sl.id} />
                <input name="title" defaultValue={sl.title} required className="input sm:col-span-4" /><input name="timeText" defaultValue={sl.timeText ?? ""} placeholder="Zeit" className="input sm:col-span-3" />
                <input name="capacity" type="number" min={1} defaultValue={sl.capacity} className="input sm:col-span-2" /><input name="description" defaultValue={sl.description ?? ""} placeholder="Beschreibung" className="input sm:col-span-12" />
                <button className="btn-light sm:col-span-3">Speichern</button></form>
              <form action={deleteSlot} className="mt-1"><input type="hidden" name="id" value={sl.id} /><input type="hidden" name="eventId" value={ev.id} /><button className="btn-danger">Slot löschen</button></form>
            </details></li>))}</ul>
        <form action={saveSlot} className="grid gap-2 sm:grid-cols-12"><input type="hidden" name="eventId" value={ev.id} />
          <input name="title" required placeholder="z. B. Getränkeausgabe" className="input sm:col-span-4" /><input name="timeText" placeholder="14:00–16:00" className="input sm:col-span-3" />
          <input name="capacity" type="number" min={1} defaultValue={2} title="Plätze" className="input sm:col-span-2" /><input name="description" placeholder="Beschreibung (optional)" className="input sm:col-span-12" />
          <button className="btn sm:col-span-3">Slot anlegen</button></form>
      </section>

      <section className="card mb-4">
        <h2 className="mb-2">Zu- und Absagen</h2>
        {(() => { const c = (st: string) => ev.rsvps.filter((r) => r.status === st); const pax = c("JA").reduce((a, r) => a + 1 + r.guests, 0);
          return <><p className="text-sm text-stone-700">✅ {c("JA").length} Zusagen ({pax} Personen inkl. Begleitung) · ❓ {c("VIELLEICHT").length} vielleicht · ❌ {c("NEIN").length} Absagen</p>
            <p className="mt-1 text-sm text-stone-600">{c("JA").map((r) => `${r.person.name}${r.guests ? ` +${r.guests}` : ""}`).join(", ")}</p></>; })()}
        {!ev.published && <p className="mt-2 text-xs text-amber-700">Die Veranstaltung ist noch ein Entwurf – Bewohner sehen sie erst nach Veröffentlichung.</p>}
      </section>

      <section className="card mb-4">
        <h2 className="mb-2">Lessons Learned</h2>
        <form action={saveLessons}><input type="hidden" name="id" value={ev.id} />
          <textarea name="lessonsLearned" rows={5} defaultValue={ev.lessonsLearned ?? ""} placeholder="Was lief gut? Was machen wir nächstes Mal anders?" className="input" />
          <button className="btn mt-2">Speichern</button></form>
      </section>

      <section className="card mb-4">
        <h2 className="mb-2">Als Vorlage speichern</h2>
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
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="published" defaultChecked={ev.published} /> Für Bewohner veröffentlichen (Titel, Datum, Ort, Beschreibung, Helfer-Slots, Zu-/Absage – keine Aufgaben)</label>
          {!ev.published && pushEnabled() && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="notify" /> Beim Veröffentlichen alle per Push einladen</label>}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="shift" /> Bei Datumsänderung alle Fristen mitverschieben</label>
          <button className="btn w-fit">Speichern</button></form>
        <form action={deleteEvent} className="mt-4"><input type="hidden" name="id" value={ev.id} /><button className="btn-danger">Veranstaltung löschen</button></form>
      </details>

      <section className="card"><h2 className="mb-2">Änderungsprotokoll</h2>
        <ul className="space-y-1 text-sm text-stone-600">{ev.log.map((l) => <li key={l.id}><span className="text-stone-400">{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(l.createdAt)}</span> {l.text}</li>)}</ul></section>
    </>
  );
}
