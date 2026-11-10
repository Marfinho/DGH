import { requireUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";

export default async function Aushang() {
  await requireUser("ORGANISATOR");
  return (
    <>
      <PageTitle>Aushang drucken</PageTitle>
      <p className="mb-4 text-stone-600">Für Schaukasten, Dorfladen oder Bäcker – für alle, die kein Smartphone nutzen. Erzeugt ein DIN-A4-PDF mit großer Schrift: kommende Termine, Müllabfuhr, Neuigkeiten und ein QR-Code zur App. Es enthält nur veröffentlichte Termine.</p>
      <form action="/api/aushang" method="get" target="_blank" className="card grid max-w-xl gap-3 sm:grid-cols-2">
        <div><label className="label">Termine der nächsten …</label><select name="tage" defaultValue="60" className="input"><option value="30">30 Tage</option><option value="60">60 Tage</option><option value="90">90 Tage</option><option value="180">6 Monate</option></select></div>
        <div><label className="label">Müllabfuhr der nächsten …</label><select name="muell" defaultValue="8" className="input"><option value="0">nicht aufnehmen</option><option value="4">4 Wochen</option><option value="8">8 Wochen</option><option value="12">12 Wochen</option></select></div>
        <input type="hidden" name="news" value="0" /><label className="flex min-h-[44px] items-center gap-2 font-semibold sm:col-span-2"><input type="checkbox" name="news" value="1" defaultChecked className="h-5 w-5" /> Aktuelle Neuigkeiten aufnehmen</label>
        <div className="sm:col-span-2"><button className="btn w-full sm:w-auto">PDF erzeugen</button></div>
      </form>
    </>
  );
}
