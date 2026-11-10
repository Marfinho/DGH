import { db } from "@/lib/db";
import { requireUser, ROLE_LABEL, appUrl, type Role } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { PushToggle } from "@/components/pwa";
import { saveProfile, renewCalendarToken, deleteOwnAccount } from "./actions";
import { logoutEverywhere } from "../login/actions";

export default async function Profil() {
  const me = await requireUser();
  const url = me.calToken ? `${appUrl()}/api/ical/${me.calToken}` : null;
  const vapid = process.env.VAPID_PUBLIC_KEY;
  return (
    <>
      <PageTitle>Mein Profil</PageTitle>
      <p className="mb-4 text-sm text-stone-600">Rolle: <b>{ROLE_LABEL[me.role as Role]}</b></p>
      <form action={saveProfile} className="card mb-4 grid gap-3 sm:grid-cols-4">
        <div><label className="label">Name</label><input name="name" defaultValue={me.name} required className="input" /></div>
        <div><label className="label">E-Mail (für Anmelde-Link)</label><input name="email" type="email" defaultValue={me.email ?? ""} className="input" /></div>
        <div><label className="label">Telefon</label><input name="phone" defaultValue={me.phone ?? ""} className="input" /></div>
        <div className="flex items-end"><button className="btn">Speichern</button></div>
      </form>

      <section className="card mb-4"><h2 className="mb-2 ">Benachrichtigungen</h2>
        {vapid ? <PushToggle vapidKey={vapid} /> : <p className="text-sm text-stone-500">Push ist auf diesem Server noch nicht eingerichtet.</p>}</section>

      <section className="card mb-4"><h2 className="mb-2 ">Kalender abonnieren (iCal)</h2>
        <p className="mb-2 text-sm text-stone-600">Enthält veröffentlichte Veranstaltungen, deine Helfer-Einsätze und deine offenen Aufgaben. Mit <code>?muell=1</code> am Ende kommt auch die Müllabfuhr dazu. <b>Der Link ist geheim</b> – gib ihn nicht weiter.</p>
        {url && <input readOnly value={url} className="input mb-2 font-mono text-xs" />}
        <form action={renewCalendarToken}><button className="btn-light">{url ? "Neuen Link erzeugen (alter wird ungültig)" : "Kalender-Link erzeugen"}</button></form></section>

      <section className="card mb-4"><h2 className="mb-2 ">Meine Daten</h2>
        <div className="flex flex-wrap gap-2"><a href="/api/export" className="btn-light">Daten herunterladen (JSON)</a>
          <form action={logoutEverywhere}><button className="btn-light">Auf allen Geräten abmelden</button></form></div>
        <form action={deleteOwnAccount} className="mt-4"><p className="mb-1 text-sm text-stone-600">Dein Konto wird samt Zu-/Absagen und Helfer-Einträgen gelöscht; deine Aufgaben bleiben ohne Zuständigen bestehen.</p><button className="btn-danger">Konto endgültig löschen</button></form></section>
    </>
  );
}
