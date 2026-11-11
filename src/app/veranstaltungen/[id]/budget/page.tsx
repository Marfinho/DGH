import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { budgetAccess } from "@/lib/budget-access";
import { formatMoney, toInputMoney } from "@/lib/money";
import { summarize, canPay, STATUS_LABEL, type BudgetKind, type ItemStatus } from "@/lib/budget";
import { formatDay } from "@/lib/dates";
import { EventHero } from "@/components/ui";
import { EventTabs } from "@/components/event-tabs";
import { hasRole } from "@/lib/auth";
import { formatSize } from "@/lib/files";
import { uploadFile, deleteFile } from "../../dateien";
import { saveBudgetSettings, saveItem, deleteItem, submitItem, decideItem, markPaid, reopenItem, addFreigeber, removeFreigeber } from "./actions";

const MONEY_ATTRS = { inputMode: "decimal" as const, pattern: "[0-9.,\\s€]+", title: "Betrag, z. B. 12,50", autoComplete: "off" };
const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Berlin" }).format(d) : "");

const badgeCls: Record<ItemStatus, string> = {
  ENTWURF: "border-2 border-brand-600 text-brand-600", BEANTRAGT: "bg-sun text-ink", FREIGEGEBEN: "bg-brand-600 text-white",
  ABGELEHNT: "bg-poster text-white", BEZAHLT: "bg-ink text-white",
};

export default async function BudgetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; datei?: string }> }) {
  const { fehler, datei } = await searchParams;
  const me = await requireUser();
  const id = Number((await params).id);
  const acc = await budgetAccess(id, me);
  if (!acc.view) redirect(`/veranstaltungen/${id}`);
  const ev = await db.event.findUnique({
    where: { id },
    include: { areas: { orderBy: [{ sort: "asc" }, { name: "asc" }] }, budgetItems: { orderBy: [{ kind: "asc" }, { createdAt: "asc" }], include: { requestedBy: true, decidedBy: true, area: true, attachments: true } }, members: { where: { role: "FREIGEBER" }, include: { person: true } } },
  });
  if (!ev) notFound();
  const people = acc.manage ? await db.person.findMany({ orderBy: { name: "asc" } }) : [];
  const s = summarize(ev.budgetItems, ev.budgetCents);
  const pct = ev.budgetCents ? Math.min(100, Math.round((s.expectedExpense / ev.budgetCents) * 100)) : 0;
  type It = (typeof ev.budgetItems)[number];

  const itemForm = (it: It | null, kind: BudgetKind) => (
    <form action={saveItem} className="mt-2 grid gap-2 sm:grid-cols-12">
      <input type="hidden" name="eventId" value={id} /><input type="hidden" name="kind" value={kind} />{it && <input type="hidden" name="id" value={it.id} />}
      <input name="title" required defaultValue={it?.title} placeholder={kind === "AUSGABE" ? "z. B. Zeltmiete" : "z. B. Standgebühren"} className="input sm:col-span-5" />
      <select name="areaId" defaultValue={it?.areaId ?? ""} className="input sm:col-span-3" aria-label="Themengebiet"><option value="">– Themengebiet –</option>{ev.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input name="planned" required defaultValue={it ? toInputMoney(it.plannedCents) : ""} placeholder="Betrag in €" {...MONEY_ATTRS} className="input sm:col-span-2" />
      <button className={`${it ? "btn-light" : "btn"} sm:col-span-2`}>{it ? "Speichern" : "Hinzufügen"}</button>
      <input name="note" defaultValue={it?.note ?? ""} placeholder="Notiz (optional)" className="input sm:col-span-12" />
    </form>
  );

  const row = (it: It) => {
    const st = it.status as ItemStatus, kind = it.kind as BudgetKind;
    const small = kind === "AUSGABE" && it.plannedCents <= ev.approvalLimitCents;
    const mayDecide = acc.approve && it.status === "BEANTRAGT" && it.requestedById !== me.id;
    return (
      <li key={it.id} className="border-t-2 border-stone-200 py-3 first:border-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wide ${badgeCls[st]}`}>{STATUS_LABEL[kind][st]}</span>
          <span className="min-w-0 flex-1 font-semibold">{it.title}{(it.area ?? it.category) && <span className="ml-2 rounded border-2 border-stone-300 px-1.5 text-xs font-bold uppercase text-stone-600">{it.area?.name ?? it.category}</span>}</span>
          <span className="text-right font-display text-xl font-bold">
            {it.status === "BEZAHLT" && it.actualCents != null ? <>{formatMoney(it.actualCents)}{it.actualCents !== it.plannedCents && <span className="ml-2 text-sm font-normal text-stone-500 line-through">{formatMoney(it.plannedCents)}</span>}</> : formatMoney(it.plannedCents)}
          </span>
        </div>
        {it.note && <p className="text-sm text-stone-600">{it.note}</p>}
        {it.attachments.length > 0 && <ul className="mt-1 flex flex-wrap gap-x-4 text-sm">{it.attachments.map((a) => <li key={a.id}><a href={`/api/files/${a.id}`} className="font-semibold text-brand-600 underline">📎 {a.name}</a> <span className="text-stone-500">({formatSize(a.size)})</span>{acc.manage && <form action={deleteFile} className="ml-1 inline"><input type="hidden" name="id" value={a.id} /><button aria-label={`${a.name} löschen`} className="text-poster">✕</button></form>}</li>)}</ul>}
        {it.requestedBy && it.status !== "ENTWURF" && <p className="text-xs text-stone-500">Beantragt von {it.requestedBy.name}</p>}
        {it.decidedBy && <p className={`text-xs font-semibold ${it.status === "ABGELEHNT" ? "text-poster" : "text-brand-600"}`}>{it.status === "ABGELEHNT" ? "Abgelehnt" : "Freigegeben"} von {it.decidedBy.name} am {when(it.decidedAt)}{it.decisionNote ? ` – „${it.decisionNote}“` : ""}</p>}
        {it.status === "BEANTRAGT" && it.requestedById === me.id && acc.approve && <p className="text-xs font-semibold text-stone-600">Du hast diese Anfrage gestellt – sie muss von jemand anderem freigegeben werden.</p>}

        {mayDecide && (
          <form className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={it.id} />
            <input name="note" placeholder="Begründung (bei Ablehnung Pflicht)" className="input min-w-[12rem] flex-1" />
            <button formAction={decideItem.bind(null, "FREIGEGEBEN")} className="btn">Freigeben</button>
            <button formAction={decideItem.bind(null, "ABGELEHNT")} className="btn-danger">Ablehnen</button>
          </form>
        )}

        {acc.manage && (
          <div className="mt-2 flex flex-wrap items-start gap-2">
            {kind === "AUSGABE" && ["ENTWURF", "ABGELEHNT"].includes(it.status) && !small && (
              <form action={submitItem}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={it.id} /><button className="btn-sun">Zur Freigabe einreichen</button></form>
            )}
            {canPay(it, ev.approvalLimitCents) && (
              <form action={markPaid} className="flex items-center gap-2"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={it.id} />
                <input name="actual" defaultValue={toInputMoney(it.plannedCents)} aria-label="Tatsächlicher Betrag" {...MONEY_ATTRS} className="input !w-32" />
                <button className="btn-light">{kind === "AUSGABE" ? "Als bezahlt buchen" : "Als eingegangen buchen"}</button></form>
            )}
            {it.status === "BEZAHLT" && <form action={reopenItem}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={it.id} /><button className="btn-light">Zahlung zurücknehmen</button></form>}
            <details><summary className="py-2 text-sm font-semibold text-brand-600">Beleg anhängen</summary>
              <form action={uploadFile} className="mt-1 flex flex-wrap items-center gap-2"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="budgetItemId" value={it.id} /><input type="file" name="file" required className="input !w-auto !p-1.5" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.odt,.ods,.txt,.csv" /><button className="btn-light">Hochladen</button></form></details>
            <details className="flex-1"><summary className="py-2 text-sm font-semibold text-brand-600">Bearbeiten</summary>
              {itemForm(it, kind)}
              {["BEANTRAGT", "FREIGEGEBEN"].includes(it.status) && <p className="mt-1 text-xs text-stone-600">Hinweis: Wird Titel oder Betrag geändert, muss die Ausgabe erneut freigegeben werden.</p>}
              <form action={deleteItem} className="mt-2"><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={it.id} /><button className="btn-danger">Posten löschen</button></form>
            </details>
          </div>
        )}
      </li>
    );
  };

  const stat = (label: string, value: string, extra?: React.ReactNode, tone = "") => (
    <div className="card !p-3"><div className="text-sm font-semibold text-stone-600">{label}</div><div className={`font-display text-3xl font-extrabold ${tone}`}>{value}</div>{extra}</div>
  );
  const expenses = ev.budgetItems.filter((i) => i.kind === "AUSGABE"), income = ev.budgetItems.filter((i) => i.kind === "EINNAHME");

  return (
    <>
      <p className="mb-2 text-sm"><Link href={`/veranstaltungen/${id}`} className="font-semibold text-brand-600 hover:underline">← {ev.title}</Link></p>
      <EventHero kicker={`Budget & Freigaben · ${formatDay(ev.date)}`} title={ev.title} />
      {hasRole(me, "ORGANISATOR") && <EventTabs id={id} active="budget" />}

      {datei && <p role="alert" className="mb-4 rounded-md bg-sun p-3 font-semibold">{datei}</p>}
      {fehler === "begruendung" && <p role="alert" className="mb-4 rounded-md bg-sun p-3 font-semibold text-ink">Bitte gib bei einer Ablehnung eine kurze Begründung an.</p>}
      {s.over && <p role="alert" className="mb-4 rounded-md bg-poster p-3 font-semibold text-white">Achtung: Die erwarteten Ausgaben ({formatMoney(s.expectedExpense)}) liegen {formatMoney(s.expectedExpense - (ev.budgetCents ?? 0))} über dem Budgetrahmen.</p>}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stat("Budgetrahmen", ev.budgetCents != null ? formatMoney(ev.budgetCents) : "–", ev.budgetCents ? (
          <div className="mt-1 h-3 overflow-hidden rounded border-2 border-brand-600" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={`h-full ${s.over ? "bg-poster" : "bg-brand-600"}`} style={{ width: `${pct}%` }} /></div>) : null)}
        {stat("Erwartete Ausgaben", formatMoney(s.expectedExpense), <div className="text-xs text-stone-600">{s.remaining != null ? `${s.remaining >= 0 ? "noch " + formatMoney(s.remaining) + " frei" : "überzogen"}` : "kein Rahmen gesetzt"}</div>, s.over ? "text-poster" : "")}
        {stat("Freigegeben / bezahlt", `${formatMoney(s.approved)}`, <div className="text-xs text-stone-600">bezahlt: {formatMoney(s.paid)}{s.pendingApproval ? ` · wartet: ${formatMoney(s.pendingApproval)}` : ""}</div>)}
        {stat("Ergebnis (Prognose)", formatMoney(s.result), <div className="text-xs text-stone-600">Einnahmen {formatMoney(s.expectedIncome)} · bisher {formatMoney(s.cashResult)}</div>, s.result < 0 ? "text-poster" : "text-brand-600")}
      </div>

      {ev.areas.length > 0 && (
        <section className="card mb-6"><h2 className="mb-2">Nach Themengebiet</h2>
          <ul className="text-base">{[...ev.areas.map((a) => ({ name: a.name, items: ev.budgetItems.filter((i) => i.areaId === a.id) })), { name: "Ohne Themengebiet", items: ev.budgetItems.filter((i) => !i.areaId) }].filter((g) => g.items.length).map((g) => { const gs = summarize(g.items, null);
            return <li key={g.name} className="flex flex-wrap justify-between gap-x-4 border-t-2 border-stone-200 py-2 first:border-0"><span className="font-semibold">{g.name}</span><span className="text-sm text-stone-700">Ausgaben <b>{formatMoney(gs.expectedExpense)}</b> · Einnahmen <b>{formatMoney(gs.expectedIncome)}</b> · bezahlt {formatMoney(gs.paid)}</span></li>; })}</ul></section>
      )}
      <section className="card mb-6">
        <h2 className="mb-1">Ausgaben</h2>
        <ul>{expenses.map(row)}</ul>{!expenses.length && <p className="text-sm text-stone-500">Noch keine Ausgaben geplant.</p>}
        {acc.manage && <details className="mt-2"><summary className="py-2 font-semibold text-brand-600">Ausgabe hinzufügen</summary>{itemForm(null, "AUSGABE")}</details>}
      </section>
      <section className="card mb-6">
        <h2 className="mb-1">Einnahmen</h2>
        <ul>{income.map(row)}</ul>{!income.length && <p className="text-sm text-stone-500">Noch keine Einnahmen geplant.</p>}
        {acc.manage && <details className="mt-2"><summary className="py-2 font-semibold text-brand-600">Einnahme hinzufügen</summary>{itemForm(null, "EINNAHME")}</details>}
      </section>

      <section className="card mb-6">
        <h2 className="mb-1">Freigeber für diese Veranstaltung</h2>
        <p className="mb-2 text-sm text-stone-600">Freigeber geben Ausgaben dieses Termins frei – auch wenn sie sonst nur Bewohner sind. Eigene Anfragen kann niemand selbst freigeben.</p>
        <ul className="mb-2 flex flex-wrap gap-2">{ev.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-1.5 font-semibold">{m.person.name}
            {acc.manage && <form action={removeFreigeber}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="personId" value={m.personId} /><button aria-label={`${m.person.name} entfernen`} className="text-poster">✕</button></form>}</li>))}
          {!ev.members.length && <li className="text-sm text-stone-500">Noch niemand benannt – bis dahin können nur Admins freigeben.</li>}</ul>
        {acc.manage && (
          <form action={addFreigeber} className="flex flex-wrap items-end gap-2"><input type="hidden" name="eventId" value={id} />
            <div className="min-w-[12rem] flex-1"><label className="label">Person hinzufügen</label>
              <select name="personId" className="input" defaultValue=""><option value="" disabled>– auswählen –</option>{people.filter((p) => !ev.members.some((m) => m.personId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <button className="btn">Benennen</button></form>
        )}
      </section>

      {acc.manage && (
        <section className="card">
          <h2 className="mb-2">Einstellungen</h2>
          <form action={saveBudgetSettings} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="eventId" value={id} />
            <div><label className="label">Budgetrahmen für Ausgaben (€)</label><input name="budget" defaultValue={ev.budgetCents != null ? toInputMoney(ev.budgetCents) : ""} placeholder="kein Rahmen" {...MONEY_ATTRS} className="input" /></div>
            <div><label className="label">Ohne Freigabe erlaubt bis (€)</label><input name="approvalLimit" defaultValue={toInputMoney(ev.approvalLimitCents)} {...MONEY_ATTRS} className="input" /></div>
            <div className="flex items-end"><button className="btn">Speichern</button></div>
          </form>
        </section>
      )}
    </>
  );
}
