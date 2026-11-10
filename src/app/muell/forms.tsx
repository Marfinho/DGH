"use client";
import { useActionState } from "react";
import { importWaste, generateWaste, type WasteResult } from "./actions";

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
