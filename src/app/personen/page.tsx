import { db } from "@/lib/db";
import { requireUser, ROLES, ROLE_LABEL, appUrl } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { savePerson, deletePerson, revokeSessions } from "./actions";
import { InviteButton } from "./invite";

export default async function Personen() {
  const me = await requireUser("ADMIN");
  const people = await db.person.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tasks: true } } } });
  const roleSel = (v: string) => (
    <select name="role" defaultValue={v} className="input">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
  );
  return (
    <>
      <PageTitle>Personen &amp; Zugänge</PageTitle>
      <p className="mb-4 text-sm text-stone-600">
        Lege Personen an und erzeuge einen <b>Einladungscode</b> (einmalig, 7 Tage gültig) – damit melden sie sich erstmals an. Danach geht es auch per E-Mail-Link, wenn eine Adresse hinterlegt ist.
        Löschen entfernt die Person vollständig; ihre Aufgaben bleiben ohne Zuständigen bestehen.
      </p>
      <p className="mb-4"><a href="/api/backup" className="btn-light">Datenbank-Backup herunterladen</a> <span className="ml-2 text-sm text-stone-600">Ein automatisches Backup läuft täglich auf dem Server (siehe README).</span></p>
      <details className="card mb-6"><summary className="font-display text-2xl font-extrabold uppercase text-brand-600">Button für die Dorf-Website</summary>
        <p className="my-2 text-sm text-stone-600">Diesen Code in die Website einfügen (z. B. WordPress: Block „Eigenes HTML“). Der Button führt direkt zur Seite „Dorfplaner aufs Handy holen“ mit Installationsknopf und Anmeldung; der QR-Code unter <a className="font-semibold text-brand-600 underline" href="/installieren">/installieren</a> eignet sich für Aushang und Flyer.</p>
        <textarea readOnly rows={5} className="input font-mono text-xs" value={`<a href="${appUrl()}/installieren" style="display:inline-block;background:#0B4F2A;color:#fff;font:700 20px/1.2 system-ui,sans-serif;padding:14px 22px;border-radius:8px;text-decoration:none;border:3px solid #0B4F2A">📱 Dorfplaner-App aufs Handy holen</a>`} />
        <p className="mt-2 text-sm font-semibold">Vorschau:</p>
        <a href="/installieren" style={{ display: "inline-block", background: "#0B4F2A", color: "#fff", font: "700 20px/1.2 system-ui,sans-serif", padding: "14px 22px", borderRadius: 8, textDecoration: "none", border: "3px solid #0B4F2A" }}>📱 Dorfplaner-App aufs Handy holen</a>
      </details>
      <form action={savePerson} className="card mb-6 grid gap-3 sm:grid-cols-5">
        <div><label className="label">Name *</label><input name="name" required className="input" /></div>
        <div><label className="label">E-Mail</label><input name="email" type="email" className="input" /></div>
        <div><label className="label">Telefon</label><input name="phone" className="input" /></div>
        <div><label className="label">Rolle</label>{roleSel("BEWOHNER")}</div>
        <div className="flex items-end"><button className="btn">Hinzufügen</button></div>
      </form>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id} className="card space-y-2">
            <form action={savePerson} className="grid gap-2 sm:grid-cols-5">
              <input type="hidden" name="id" value={p.id} />
              <input name="name" defaultValue={p.name} required className="input" />
              <input name="email" defaultValue={p.email ?? ""} type="email" placeholder="E-Mail" className="input" />
              <input name="phone" defaultValue={p.phone ?? ""} placeholder="Telefon" className="input" />
              {roleSel(p.role)}
              <button className="btn-light">Speichern</button>
            </form>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <InviteButton id={p.id} />
              <form action={revokeSessions}><input type="hidden" name="id" value={p.id} /><button className="btn-light">Abmelden (alle Geräte)</button></form>
              {p.id !== me.id && <form action={deletePerson}><input type="hidden" name="id" value={p.id} /><button className="btn-danger">Löschen ({p._count.tasks} Aufg.)</button></form>}
              <span className="text-xs text-stone-500">{p.lastLoginAt ? `zuletzt angemeldet ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeZone: "Europe/Berlin" }).format(p.lastLoginAt)}` : "noch nie angemeldet"}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
