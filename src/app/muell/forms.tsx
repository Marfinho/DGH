"use client";
import { useActionState } from "react";
import { importWaste, generateWaste, importIcsFile, addAwsSource, addUrlSource, type WasteResult } from "./actions";

const Msg = ({ s }: { s: WasteResult }) => (s ? <p className={`text-sm ${s.error ? "text-poster" : "text-green-800"}`}>{s.error ?? s.ok}</p> : null);

export function ImportForm() {
  const [s, a, p] = useActionState(importWaste, null);
  return (<form action={a} className="space-y-2"><label className="label">Termine einfügen (eine Zeile pro Termin: <code>24.12.2027;Restmüll</code>)</label>
    <textarea name="csv" rows={5} className="input font-mono" placeholder={"07.01.2027;Restmüll\n14.01.2027;Papier"} /><button className="btn" disabled={p}>Importieren</button><Msg s={s} /></form>);
}
export function GenerateForm() {
  const [s, a, p] = useActionState(generateWaste, null);
  return (<form action={a} className="grid gap-2 sm:grid-cols-5"><input name="type" required placeholder="Art, z. B. Bio" className="input" /><input name="start" type="date" required className="input" />
    <input name="every" type="number" min={1} defaultValue={14} title="Alle … Tage" className="input" /><input name="count" type="number" min={1} defaultValue={26} title="Anzahl" className="input" />
    <button className="btn" disabled={p}>Erzeugen</button><div className="sm:col-span-5"><Msg s={s} /></div></form>);
}

export function IcsForm() {
  const [s, a, p] = useActionState(importIcsFile, null);
  return (<form action={a} className="space-y-2">
    <p className="text-sm text-stone-600">Viele Landkreise und Entsorger bieten ihre Abfuhrtermine als Kalenderdatei (<code>.ics</code>) zum Download an. Datei hier hochladen – die Art der Tonne wird aus dem Terminnamen übernommen, vorhandene Termine werden nicht doppelt angelegt.</p>
    <div><label className="label">Kalenderdatei (.ics)</label><input type="file" name="file" accept=".ics,text/calendar" className="input !p-1.5" /></div>
    <details><summary className="text-sm font-semibold text-brand-600">oder Inhalt einfügen</summary><textarea name="text" rows={4} className="input mt-1 font-mono text-xs" placeholder="BEGIN:VCALENDAR …" /></details>
    <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" name="replace" className="h-5 w-5" /> Vorhandene zukünftige Termine dieser Tonnenarten vorher ersetzen</label>
    <button className="btn" disabled={p}>Kalenderdatei importieren</button><Msg s={s} /></form>);
}

export function AwsForm() {
  const [s, a, p] = useActionState(addAwsSource, null);
  return (<form action={a} className="grid gap-2 sm:grid-cols-12">
    <div className="sm:col-span-3"><label className="label">Ort</label><input name="ort" required defaultValue={s?.values?.ort ?? "Haste"} className="input" /></div>
    <div className="sm:col-span-4"><label className="label">Straße</label><input name="strasse" required defaultValue={s?.values?.strasse} placeholder="z. B. Dorfstr." className="input" /></div>
    <div className="sm:col-span-2"><label className="label">Haus-Nr.</label><input name="hausnummer" required defaultValue={s?.values?.hausnummer} className="input" /></div>
    <div className="sm:col-span-3"><label className="label">Zusatz (z. B. A)</label><input name="zusatz" defaultValue={s?.values?.zusatz} className="input" /></div>
    <div className="sm:col-span-9"><label className="label">Bezeichnung (nur nötig, wenn es mehrere Bereiche gibt)</label><input name="label" maxLength={40} defaultValue={s?.values?.label} className="input" placeholder="z. B. Oberdorf" /></div>
    <div className="flex items-end sm:col-span-3"><button className="btn w-full" disabled={p}>{p ? "Suche …" : "Einrichten"}</button></div>
    <div className="sm:col-span-12"><Msg s={s} /></div>
  </form>);
}
export function UrlForm() {
  const [s, a, p] = useActionState(addUrlSource, null);
  return (<form action={a} className="space-y-2">
    <div><label className="label">Kalender-Abo-Adresse aus dem AWS-Portal (Abfuhrtermine → „ical-Kalenderabo“ → URL)</label><input name="url" required defaultValue={s?.values?.url} className="input font-mono text-xs" placeholder="https://kundenlogin.aws-shg.de/WasteManagementSchaumburg/WasteManagementServiceServlet?…" /></div>
    <div><label className="label">Bezeichnung (optional)</label><input name="label" maxLength={40} defaultValue={s?.values?.label} className="input" /></div>
    <button className="btn" disabled={p}>Adresse übernehmen</button><Msg s={s} /></form>);
}
