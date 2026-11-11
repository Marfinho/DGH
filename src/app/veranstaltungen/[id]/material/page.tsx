import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { MATERIAL_LABEL, MATERIAL_STATUS, materialSummary, type MaterialStatus } from "@/lib/plan";
import { EventHero } from "@/components/ui";
import { EventTabs } from "@/components/event-tabs";
import { PrintButton } from "@/components/print-button";
import { AutoSelect } from "@/components/auto-select";
import { saveMaterial, cycleMaterial, assignMaterial, deleteMaterial } from "../../plan-actions";

const cls: Record<MaterialStatus, string> = { OFFEN: "border-2 border-poster text-poster", ORGANISIERT: "bg-sun text-ink", VOR_ORT: "bg-brand-600 text-white" };

export default async function Material({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ zeige?: string }> }) {
  await requireUser("ORGANISATOR");
  const id = Number((await params).id);
  const { zeige } = await searchParams;
  const [ev, people] = await Promise.all([
    db.event.findUnique({ where: { id }, include: { material: { orderBy: [{ sort: "asc" }, { id: "asc" }], include: { responsible: { select: { name: true } } } } } }),
    db.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!ev) notFound();
  const sum = materialSummary(ev.material);
  const onlyOpen = zeige === "offen";
  const list = onlyOpen ? ev.material.filter((m) => m.status === "OFFEN") : ev.material;
  type It = (typeof ev.material)[number];

  const form = (it: It | null) => (
    <form action={saveMaterial} className="grid gap-2 sm:grid-cols-12">
      <input type="hidden" name="eventId" value={id} />{it && <input type="hidden" name="id" value={it.id} />}
      <input name="title" required maxLength={200} defaultValue={it?.title} placeholder="Was? z. B. Bierzeltgarnituren" className="input sm:col-span-4" aria-label="Was" />
      <input name="quantity" maxLength={60} defaultValue={it?.quantity ?? ""} placeholder="Menge, z. B. 10 Sets" className="input sm:col-span-2" aria-label="Menge" />
      <input name="source" maxLength={120} defaultValue={it?.source ?? ""} placeholder="Woher? Inventar / kaufen / leihen bei …" className="input sm:col-span-3" aria-label="Woher" />
      <select name="responsibleId" defaultValue={it?.responsibleId ?? ""} className="input sm:col-span-3" aria-label="Kümmert sich"><option value="">– wer kümmert sich –</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input name="note" maxLength={500} defaultValue={it?.note ?? ""} placeholder="Notiz (optional)" className="input sm:col-span-6" aria-label="Notiz" />
      {it && <select name="status" defaultValue={it.status} className="input sm:col-span-3" aria-label="Status">{MATERIAL_STATUS.map((s) => <option key={s} value={s}>{MATERIAL_LABEL[s]}</option>)}</select>}
      <button className={`${it ? "btn-light" : "btn"} ${it ? "sm:col-span-3" : "sm:col-span-6"}`}>{it ? "Speichern" : "Hinzufügen"}</button>
    </form>
  );

  return (
    <>
      <div className="print:hidden"><EventHero kicker={`${formatDay(ev.date)}${ev.location ? ` · ${ev.location}` : ""}`} title={ev.title} /></div>
      <EventTabs id={id} active="material" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-3xl">Material & Einkauf</h1>
          <p className="text-sm text-stone-600 print:hidden">Tippe auf den Status, um ihn weiterzuschalten: <b>Offen</b> → <b>Organisiert</b> (bestellt/zugesagt) → <b>Vor Ort</b>.</p></div>
        <PrintButton label="Liste drucken" />
      </div>
      <p className="mb-3 hidden text-lg font-bold print:block">{ev.title} · {formatDay(ev.date)} – Material & Einkauf</p>

      {sum.total > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
          <span className="font-semibold">{sum.done} von {sum.total} organisiert</span>
          <span className="text-sm text-stone-600">{sum.OFFEN} offen · {sum.ORGANISIERT} organisiert · {sum.VOR_ORT} vor Ort</span>
          <a href={onlyOpen ? `/veranstaltungen/${id}/material` : `/veranstaltungen/${id}/material?zeige=offen`} className="btn-light ml-auto !min-h-[40px]">{onlyOpen ? "Alle zeigen" : "Nur offene"}</a>
        </div>
      )}

      <section className="card mb-4 print:border print:shadow-none">
        {!list.length && <p className="text-sm text-stone-600">{onlyOpen ? "Nichts mehr offen 🎉" : "Noch keine Einträge. Was wird gebraucht, gekauft oder geliehen?"}</p>}
        <ul>
          {list.map((m) => (
            <li key={m.id} className="border-t-2 border-stone-200 py-2 first:border-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <form action={cycleMaterial}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={m.id} />
                  <button title="Status weiterschalten" className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase ${cls[m.status as MaterialStatus] ?? cls.OFFEN}`}>{m.status === "VOR_ORT" ? "✓ " : ""}{MATERIAL_LABEL[m.status as MaterialStatus] ?? m.status}</button></form>
                <span className={`font-semibold ${m.status === "VOR_ORT" ? "text-stone-500" : ""}`}>{m.title}</span>
                {m.quantity && <span className="font-display text-lg font-bold">{m.quantity}</span>}
                {m.source && <span className="text-sm text-stone-600">{m.source}</span>}
                <span className="hidden text-sm print:inline">{m.responsible?.name ?? ""}</span>
                <span className="ml-auto print:hidden"><AutoSelect action={assignMaterial} name="responsibleId" value={m.responsibleId ?? ""} hidden={{ id: m.id, eventId: id }} label={`Wer kümmert sich um ${m.title}`} options={[{ value: "", label: "– niemand –" }, ...people.map((p) => ({ value: p.id, label: p.name }))]} /></span>
              </div>
              {m.note && <p className="text-sm text-stone-600">{m.note}</p>}
              <details className="mt-1 print:hidden"><summary className="cursor-pointer text-xs text-brand-600">Bearbeiten</summary>
                <div className="mt-2">{form(m)}</div>
                <form action={deleteMaterial} className="mt-2"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={m.id} /><button className="btn-danger">Löschen</button></form>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <section className="card print:hidden"><h2 className="mb-2">Eintrag hinzufügen</h2>{form(null)}</section>
    </>
  );
}
