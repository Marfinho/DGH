import { db } from "@/lib/db";
import { requireUser, ROLE_LABEL, appUrl, type Role } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { PushToggle } from "@/components/pwa";
import { saveProfile, renewCalendarToken, deleteOwnAccount, saveWastePrefs } from "./actions";
import { logoutEverywhere } from "../login/actions";

export default async function Profil() {
  const me = await requireUser();
  const wasteTypes = (await db.wasteDate.findMany({ distinct: ["type"], select: { type: true }, orderBy: { type: "asc" } })).map((w) => w.type);
  const mineTypes = me.wasteTypes ? me.wasteTypes.split(",") : null;
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

      <section className="card mb-4"><h2 className="mb-2">Müll-Erinnerung</h2>
        <form action={saveWastePrefs} className="space-y-2">
          <label className="flex min-h-[44px] items-center gap-2 font-semibold"><input type="checkbox" name="wastePush" defaultChecked={me.wastePush} className="h-5 w-5" /> Am Vorabend per Push erinnern</label>
          {wasteTypes.length > 0 ? <fieldset className="flex flex-wrap gap-x-4 gap-y-1"><legend className="label">Welche Tonnen? (nichts gewählt = alle)</legend>
            {wasteTypes.map((t) => <label key={t} className="flex min-h-[40px] items-center gap-2"><input type="checkbox" name="types" value={t} defaultChecked={!!mineTypes?.includes(t)} className="h-5 w-5" />{t}</label>)}</fieldset>
            : <p className="text-sm text-stone-500">Noch keine Abfuhrtermine hinterlegt.</p>}
          {!vapid && <p className="text-xs text-poster">Push ist auf diesem Server noch nicht eingerichtet.</p>}
          <p className="text-xs text-stone-500">Voraussetzung: Benachrichtigungen oben aktivieren. Die Erinnerung kommt abends (ca. 18 Uhr).</p>
          <button className="btn">Speichern</button></form></section>

      <section className="card mb-4"><h2 className="mb-2">Kalender abonnieren (iCal)</h2>
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
