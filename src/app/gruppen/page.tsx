import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { saveGroup, deleteGroup, saveContact, deleteContact } from "./actions";

export default async function Gruppen() {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const [groups, loose] = await Promise.all([
    db.group.findMany({ orderBy: { name: "asc" }, include: { contacts: { orderBy: { sort: "asc" } } } }),
    db.contact.findMany({ where: { groupId: null }, orderBy: { name: "asc" } }),
  ]);
  type C = (typeof loose)[number];
  const contact = (c: C) => (
    <li key={c.id} className="border-t border-stone-100 py-2 text-sm first:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-medium">{c.name}</span>{c.function && <span className="text-stone-600">{c.function}</span>}
        {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-brand-600 hover:underline">📞 {c.phone}</a>}{c.email && <a href={`mailto:${c.email}`} className="text-brand-600 hover:underline">✉ {c.email}</a>}</div>
      {orga && <details><summary className="cursor-pointer text-xs text-stone-500">Bearbeiten</summary>{contactForm(c)}<form action={deleteContact} className="mt-1"><input type="hidden" name="id" value={c.id} /><button className="btn-danger">Löschen</button></form></details>}
    </li>
  );
  const contactForm = (c: C | null, groupId?: number) => (
    <form action={saveContact} className="mt-2 grid gap-2 sm:grid-cols-5">{c && <input type="hidden" name="id" value={c.id} />}<input type="hidden" name="groupId" value={c?.groupId ?? groupId ?? ""} />
      <input name="name" required defaultValue={c?.name} placeholder="Name" className="input" /><input name="function" defaultValue={c?.function ?? ""} placeholder="Funktion" className="input" />
      <input name="phone" defaultValue={c?.phone ?? ""} placeholder="Telefon" className="input" /><input name="email" defaultValue={c?.email ?? ""} placeholder="E-Mail" className="input" />
      <button className={c ? "btn-light" : "btn"}>{c ? "Speichern" : "Kontakt hinzufügen"}</button></form>
  );
  return (
    <>
      <PageTitle>Vereine, Gruppen &amp; Ansprechpartner</PageTitle>
      {orga && <p className="mb-4 text-sm text-stone-600">Alles, was du hier einträgst, sehen <b>alle angemeldeten Bewohner</b>. Trage Kontaktdaten daher nur mit Einverständnis der Person ein.</p>}
      <section className="card mb-6"><h2 className="mb-1 font-semibold">Allgemeine Ansprechpartner</h2><ul>{loose.map(contact)}</ul>{!loose.length && <p className="text-sm text-stone-500">Noch keine Einträge.</p>}
        {orga && <details className="mt-2"><summary className="cursor-pointer text-sm text-brand-600">Ansprechpartner hinzufügen</summary>{contactForm(null)}</details>}</section>
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.id} className="card">
            <h2 className="font-semibold">{g.name}</h2>
            {g.meetingInfo && <p className="text-sm text-stone-600">🕒 {g.meetingInfo}</p>}
            {g.description && <p className="mt-1 whitespace-pre-line text-sm">{g.description}</p>}
            {g.website && <a href={g.website} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">🌐 {g.website}</a>}
            <ul className="mt-2">{g.contacts.map(contact)}</ul>
            {orga && <>
              <details className="mt-1"><summary className="cursor-pointer text-sm text-brand-600">Kontakt hinzufügen</summary>{contactForm(null, g.id)}</details>
              <details className="mt-1"><summary className="cursor-pointer text-xs text-stone-500">Gruppe bearbeiten</summary>
                <form action={saveGroup} className="mt-2 grid gap-2 sm:grid-cols-2"><input type="hidden" name="id" value={g.id} />
                  <input name="name" defaultValue={g.name} required className="input" /><input name="meetingInfo" defaultValue={g.meetingInfo ?? ""} placeholder="Treffen" className="input" />
                  <input name="website" defaultValue={g.website ?? ""} placeholder="Webseite" className="input" /><textarea name="description" defaultValue={g.description ?? ""} rows={2} placeholder="Beschreibung" className="input" />
                  <button className="btn-light w-fit">Speichern</button></form>
                <form action={deleteGroup} className="mt-1"><input type="hidden" name="id" value={g.id} /><button className="btn-danger">Gruppe löschen</button></form></details></>}
          </section>
        ))}
      </div>
      {orga && <form action={saveGroup} className="card mt-6 grid gap-2 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Neue Gruppe / neuer Verein</h2>
        <input name="name" required placeholder="Name" className="input" /><input name="meetingInfo" placeholder="Treffen, z. B. jeden 1. Dienstag, 19:30" className="input" />
        <input name="website" placeholder="Webseite" className="input" /><textarea name="description" rows={2} placeholder="Beschreibung" className="input" /><button className="btn w-fit">Anlegen</button></form>}
    </>
  );
}
