import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { canManageGroup } from "@/lib/group-access";
import { toInput, formatDay } from "@/lib/dates";
import { PageTitle } from "@/components/ui";
import { saveGroupEvent, deleteGroupEvent, saveGroupNews, deleteGroupNews, addVorstand, removeVorstand } from "./actions";

export default async function VereinsBereich({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const id = Number((await params).id);
  if (!(await canManageGroup(id, me))) redirect("/gruppen");
  const g = await db.group.findUnique({
    where: { id },
    include: { members: { include: { person: true } }, events: { orderBy: { date: "desc" }, include: { rsvps: { where: { status: "JA" } }, _count: { select: { tasks: true, budgetItems: true } } } }, news: { orderBy: { publishedAt: "desc" }, take: 20 } },
  });
  if (!g) notFound();
  const orga = hasRole(me, "ORGANISATOR");
  const people = orga ? await db.person.findMany({ orderBy: { name: "asc" } }) : [];
  type E = (typeof g.events)[number];

  const eventForm = (e: E | null) => (
    <form action={saveGroupEvent} className="mt-2 grid gap-2 sm:grid-cols-12"><input type="hidden" name="groupId" value={id} />{e && <input type="hidden" name="id" value={e.id} />}
      <input name="title" required defaultValue={e?.title} placeholder="Titel, z. B. Jahreshauptversammlung" className="input sm:col-span-6" />
      <input name="date" type="date" required defaultValue={e ? toInput(e.date) : ""} className="input sm:col-span-3" />
      <input name="location" defaultValue={e?.location ?? ""} placeholder="Ort" className="input sm:col-span-3" />
      <textarea name="description" defaultValue={e?.description ?? ""} rows={2} placeholder="Beschreibung (optional)" className="input sm:col-span-12" />
      <label className="flex min-h-[44px] items-center gap-2 font-semibold sm:col-span-6"><input type="checkbox" name="published" defaultChecked={e ? e.published : true} className="h-5 w-5" /> Für alle Bewohner sichtbar</label>
      <button className={`${e ? "btn-light" : "btn"} sm:col-span-3`}>{e ? "Speichern" : "Termin anlegen"}</button>
    </form>
  );

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/gruppen" className="font-semibold text-brand-600 hover:underline">← Vereine & Kontakte</Link></p>
      <PageTitle>{g.name}</PageTitle>
      <p className="mb-4 text-stone-600">Hier pflegt der Verein seine Termine und Neuigkeiten selbst. Alles erscheint im Veranstaltungskalender bzw. bei den Neuigkeiten des Dorfes.</p>

      <section className="card mb-6"><h2 className="mb-2">Termine des Vereins</h2>
        <ul>{g.events.map((e) => (
          <li key={e.id} className="border-t-2 border-stone-200 py-2 first:border-0">
            <div className="flex flex-wrap items-center gap-x-3"><Link href={`/veranstaltungen/${e.id}`} className="font-semibold text-brand-600 hover:underline">{e.title}</Link>
              <span className="text-sm text-stone-600">{formatDay(e.date)}{e.location ? ` · ${e.location}` : ""}</span>
              {!e.published && <span className="rounded bg-sun px-1.5 text-xs font-bold uppercase">Entwurf</span>}
              <span className="ml-auto text-sm font-semibold">{e.rsvps.reduce((a, r) => a + 1 + r.guests, 0)} Zusagen</span></div>
            <details><summary className="text-sm font-semibold text-brand-600">Bearbeiten</summary>{eventForm(e)}
              {(orga || (e._count.tasks === 0 && e._count.budgetItems === 0)) && <form action={deleteGroupEvent} className="mt-2"><input type="hidden" name="groupId" value={id} /><input type="hidden" name="id" value={e.id} /><button className="btn-danger">Termin löschen</button></form>}</details>
          </li>))}{!g.events.length && <li className="text-sm text-stone-500">Noch keine Termine.</li>}</ul>
        <details className="mt-2" open={!g.events.length}><summary className="py-2 font-display text-xl font-extrabold uppercase text-brand-600">+ Neuer Termin</summary>{eventForm(null)}</details>
      </section>

      <section className="card mb-6"><h2 className="mb-2">Neuigkeiten des Vereins</h2>
        <form action={saveGroupNews} className="mb-3 space-y-2"><input type="hidden" name="groupId" value={id} /><input name="title" required placeholder="Überschrift" className="input" /><textarea name="body" required rows={3} placeholder="Text" className="input" /><button className="btn">Veröffentlichen</button></form>
        <ul>{g.news.map((n) => (<li key={n.id} className="flex flex-wrap items-center gap-2 border-t-2 border-stone-200 py-2"><span className="flex-1 font-semibold">{n.title}</span><span className="text-xs text-stone-500">{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeZone: "Europe/Berlin" }).format(n.publishedAt)}</span>
          <form action={deleteGroupNews}><input type="hidden" name="groupId" value={id} /><input type="hidden" name="id" value={n.id} /><button className="btn-danger !min-h-[36px] !px-2" aria-label={`${n.title} löschen`}>✕</button></form></li>))}</ul></section>

      <section className="card"><h2 className="mb-1">Vorstand (darf diesen Bereich pflegen)</h2>
        <ul className="mb-2 flex flex-wrap gap-2">{g.members.map((m) => (<li key={m.id} className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-1.5 font-semibold">{m.person.name}
          {orga && <form action={removeVorstand}><input type="hidden" name="groupId" value={id} /><input type="hidden" name="personId" value={m.personId} /><button aria-label={`${m.person.name} entfernen`} className="text-poster">✕</button></form>}</li>))}
          {!g.members.length && <li className="text-sm text-stone-500">Noch niemand benannt.</li>}</ul>
        {orga && <form action={addVorstand} className="flex flex-wrap items-end gap-2"><input type="hidden" name="groupId" value={id} /><div className="min-w-[12rem] flex-1"><label className="label">Person benennen</label>
          <select name="personId" defaultValue="" className="input"><option value="" disabled>– auswählen –</option>{people.filter((p) => !g.members.some((m) => m.personId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><button className="btn">Benennen</button></form>}
      </section>
    </>
  );
}
