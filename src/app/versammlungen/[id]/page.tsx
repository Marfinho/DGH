import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDay, toInput } from "@/lib/dates";
import { mailConfigured } from "@/lib/mail";
import { MAIL_STATUS_LABEL, RESPONSE_LABEL, whenText, invitationMail, mailtoHref, type Response } from "@/lib/meetings";
import { protocolInclude, protocolFromDb } from "@/lib/meetings-db";
import { appUrl } from "@/lib/auth";
import { EventHero } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { DirtyGuard } from "@/components/dirty-guard";
import {
  updateMeeting, deleteMeeting, addAgendaItems, deleteAgendaItem, moveAgendaItem, setInvitees, sendInvitations, respond,
  saveProtocol, saveAndTodo, finalizeProtocol, sendProtocol, toggleTodo, deleteTodo,
} from "../actions";

const respCls: Record<string, string> = { OFFEN: "border-2 border-stone-300 text-stone-600", ZUGESAGT: "bg-brand-600 text-white", ABGESAGT: "bg-poster text-white" };

export default async function Versammlung({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; versand?: string; art?: string; gespeichert?: string }> }) {
  const me = await requireUser("ORGANISATOR");
  const id = Number((await params).id);
  const sp = await searchParams;
  const [m, orga] = await Promise.all([
    db.meeting.findUnique({ where: { id }, include: protocolInclude }),
    db.person.findMany({ where: { role: { in: ["ORGANISATOR", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  if (!m) notFound();
  const carried = await db.meetingTodo.findMany({ where: { done: false, meeting: { date: { lt: m.date } } }, orderBy: { createdAt: "asc" }, include: { assignee: { select: { name: true } }, meeting: { select: { id: true, title: true, date: true } } } });
  const final = !!m.finalizedAt;
  const mineInv = m.invitees.find((i) => i.personId === me.id);
  const notInvited = m.invitees.filter((i) => i.personId && !i.invitedAt);
  const noMail = m.invitees.filter((i) => i.personId && !i.person?.email);
  const emails = m.invitees.map((i) => i.person?.email).filter((e): e is string => !!e);
  const smtp = mailConfigured();
  const [ok, noAddr, failed, unconf] = (sp.versand ?? "").split(",").map(Number);
  const inv = invitationMail(m, m.agenda.map((a) => a.title), "zusammen", `${appUrl()}/versammlungen/${m.id}`);
  const protocol = protocolFromDb(m);
  const hidden = <input type="hidden" name="meetingId" value={m.id} />;

  return (
    <>
      <div className="print:hidden">
        <p className="mb-2 text-sm"><Link href="/versammlungen" className="font-semibold text-brand-600 hover:underline">← Alle Versammlungen</Link></p>
        <EventHero kicker={`${whenText(m)}${m.location ? ` · ${m.location}` : ""}`} title={m.title} />
      </div>

      {sp.fehler && <p role="alert" className="mb-4 rounded bg-amber-50 p-3 text-sm font-semibold text-amber-800 print:hidden">{sp.fehler}</p>}
      {sp.gespeichert && <p role="status" className="mb-4 rounded bg-brand-50 p-3 text-sm font-semibold text-brand-700 print:hidden">Protokoll gespeichert.</p>}
      {sp.versand && (
        <div role="status" className={`mb-4 rounded p-3 text-sm print:hidden ${ok && !failed ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-800"}`}>
          <b>{sp.art === "protokoll" ? "Protokoll" : "Einladung"}:</b> {ok ? `${ok} Mail${ok === 1 ? "" : "s"} gesendet. ` : ""}
          {noAddr ? `${noAddr} ohne E-Mail-Adresse. ` : ""}{failed ? `${failed} fehlgeschlagen (siehe Server-Log). ` : ""}
          {unconf ? `Mailversand ist nicht eingerichtet (SMTP_URL fehlt) – es wurde nichts verschickt. Nutze unten „Mailprogramm öffnen“.` : ""}
          {sp.art !== "protokoll" && " Eingeladene mit App bekommen außerdem eine Push-Nachricht."}
        </div>
      )}

      {/* ---------- Teilnahme ---------- */}
      <section className="card mb-4 print:hidden">
        <h2 className="mb-2">Bist du dabei?</h2>
        <form className="flex flex-wrap gap-2">{hidden}
          <button formAction={respond.bind(null, "ZUGESAGT")} className={mineInv?.response === "ZUGESAGT" ? "btn" : "btn-light"}>{mineInv?.response === "ZUGESAGT" ? "✓ Ich komme" : "Ich komme"}</button>
          <button formAction={respond.bind(null, "ABGESAGT")} className={mineInv?.response === "ABGESAGT" ? "btn-danger !bg-poster !text-white" : "btn-danger"}>Ich kann nicht</button>
          <a href={`/versammlungen/${m.id}/termin.ics`} className="btn-light">📅 In meinen Kalender</a>
        </form>
      </section>

      {/* ---------- Einladung ---------- */}
      <section className="card mb-4 print:hidden">
        <h2 className="mb-1">Einladung</h2>
        <p className="mb-3 text-sm text-stone-600">{smtp ? "Mailversand ist eingerichtet." : <><b>Mailversand ist nicht eingerichtet</b> (SMTP_URL in der .env). Einladungen gehen dann nur per Push; zum Mailen „Mailprogramm öffnen“ nutzen.</>}</p>
        <form action={setInvitees}>{hidden}
          <ul className="mb-3 grid gap-1 sm:grid-cols-2">
            {orga.map((p) => { const i = m.invitees.find((x) => x.personId === p.id); return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border-2 border-stone-200 px-2 py-1.5">
                <label className="flex flex-1 items-center gap-2"><input type="checkbox" name="personId" value={p.id} defaultChecked={!!i} className="h-5 w-5" /><span className="font-semibold">{p.name}</span></label>
                {i && <span className={`rounded px-1.5 text-xs font-bold uppercase ${respCls[i.response]}`}>{RESPONSE_LABEL[i.response as Response]}</span>}
                <span className={`w-full pl-7 text-xs ${!p.email ? "text-poster" : "text-stone-500"}`}>{!p.email ? "keine E-Mail-Adresse hinterlegt" : i?.invitedAt ? `eingeladen ${formatDay(i.invitedAt)} · ${MAIL_STATUS_LABEL[i.mailStatus ?? ""] ?? ""}` : "noch nicht eingeladen"}</span>
              </li>); })}
          </ul>
          <button className="btn-light">Auswahl speichern</button>
        </form>
        {noMail.length > 0 && <p className="mt-2 text-sm text-poster">Ohne E-Mail-Adresse: {noMail.map((i) => i.name).join(", ")} – bekommen nur Push (falls App installiert). Adresse im Profil bzw. unter „Personen“ ergänzen.</p>}
        <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-stone-200 pt-3">
          <form>{hidden}
            {notInvited.length > 0 ? <button formAction={sendInvitations.bind(null, "neu")} className="btn">Einladung senden ({notInvited.length})</button>
              : <button formAction={sendInvitations.bind(null, "alle")} className="btn-light">Allen erneut senden (Aktualisierung)</button>}
          </form>
          <a href={mailtoHref(emails, inv.subject, inv.text)} className="btn-light">Mailprogramm öffnen</a>
        </div>
      </section>

      {/* ---------- Tagesordnung ---------- */}
      <section className="card mb-4 print:hidden">
        <h2 className="mb-2">Tagesordnung</h2>
        <ol className="mb-2">
          {m.agenda.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2 border-t border-stone-100 py-1.5 first:border-0">
              <span className="w-14 shrink-0 font-display text-lg font-bold text-brand-600">TOP {i + 1}</span><span className="flex-1 font-semibold">{a.title}</span>
              {!final && <form className="flex gap-1">{hidden}<input type="hidden" name="id" value={a.id} />
                <button formAction={moveAgendaItem.bind(null, "up")} disabled={i === 0} aria-label="nach oben" className="px-2 text-lg disabled:opacity-30">↑</button>
                <button formAction={moveAgendaItem.bind(null, "down")} disabled={i === m.agenda.length - 1} aria-label="nach unten" className="px-2 text-lg disabled:opacity-30">↓</button>
                <button formAction={deleteAgendaItem} aria-label={`${a.title} entfernen`} className="px-2 text-poster">✕</button></form>}
            </li>))}
        </ol>
        {!m.agenda.length && <p className="mb-2 text-sm text-stone-500">Noch keine Tagesordnungspunkte.</p>}
        {!final && <form action={addAgendaItems} className="flex flex-wrap gap-2">{hidden}<textarea name="titles" rows={2} maxLength={3000} placeholder="Neue Punkte – einer pro Zeile" className="input flex-1 !min-h-[48px]" aria-label="Neue Tagesordnungspunkte" /><button className="btn">Hinzufügen</button></form>}
      </section>

      {carried.length > 0 && (
        <section className="card mb-4 print:hidden"><h2 className="mb-2">Offen aus früheren Versammlungen</h2>
          <ul className="text-sm">{carried.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-3 border-t border-stone-100 py-1.5 first:border-0">
              <form action={toggleTodo}><input type="hidden" name="id" value={x.id} /><button className="rounded border-2 border-brand-600 px-1.5 text-xs font-bold uppercase text-brand-600">erledigt</button></form>
              <span className="font-semibold">{x.title}</span><span className="text-stone-600">{x.assignee?.name ?? "niemand"}</span>
              <Link href={`/versammlungen/${x.meeting.id}`} className="ml-auto text-brand-600 hover:underline">{formatDay(x.meeting.date)}</Link>
            </li>))}</ul></section>
      )}

      {/* ---------- Protokoll ---------- */}
      {!final ? (
        <section className="card mb-4 print:hidden">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2>Protokoll</h2><span className="text-sm text-stone-600">Speichern nicht vergessen – unten oder zwischendurch.</span></div>
          <form id="protokoll" action={saveProtocol} className="space-y-4">{hidden}
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="label" htmlFor="chair">Sitzungsleitung</label><input id="chair" name="chair" maxLength={120} defaultValue={m.chair ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="mt">Protokollführung</label><input id="mt" name="minuteTaker" maxLength={120} defaultValue={m.minuteTaker ?? me.name} className="input" /></div>
            </div>
            <fieldset><legend className="label">Anwesend</legend>
              <div className="flex flex-wrap gap-2">{m.invitees.map((i) => <label key={i.id} className="flex items-center gap-2 rounded-md border-2 border-stone-200 px-2 py-1"><input type="checkbox" name="present" value={i.id} defaultChecked={i.present} className="h-5 w-5" />{i.name}</label>)}</div>
              <input name="guests" maxLength={500} defaultValue={m.guests ?? ""} placeholder="Gäste (optional)" className="input mt-2" aria-label="Gäste" />
            </fieldset>
            {m.agenda.map((a, i) => (
              <fieldset key={a.id} className="rounded-md border-2 border-brand-600 p-3">
                <legend className="px-1 font-display text-xl font-bold uppercase text-brand-600">TOP {i + 1}: {a.title}</legend>
                <textarea name={`notes_${a.id}`} rows={3} maxLength={10000} defaultValue={a.notes ?? ""} placeholder="Besprochen …" className="input" aria-label={`Notizen zu TOP ${i + 1}`} />
                <input name={`decision_${a.id}`} maxLength={2000} defaultValue={a.decision ?? ""} placeholder="Beschluss (optional), z. B. „einstimmig angenommen“" className="input mt-2" aria-label={`Beschluss zu TOP ${i + 1}`} />
              </fieldset>
            ))}
            <div><label className="label" htmlFor="gn">Verschiedenes</label><textarea id="gn" name="generalNotes" rows={3} maxLength={10000} defaultValue={m.generalNotes ?? ""} className="input" /></div>

            <div className="rounded-md bg-brand-50 p-3">
              <h3 className="mb-2">To-dos</h3>
              <ul className="mb-2 text-sm">{m.todos.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-x-3 border-t border-white py-1.5 first:border-0">
                  <button formAction={saveAndTodo.bind(null, "toggle", x.id)} className={`rounded px-1.5 text-xs font-bold uppercase ${x.done ? "bg-brand-600 text-white" : "border-2 border-brand-600 text-brand-600"}`}>{x.done ? "✓ erledigt" : "offen"}</button>
                  <span className={`font-semibold ${x.done ? "line-through" : ""}`}>{x.title}</span><span className="text-stone-600">{x.assignee?.name ?? "niemand"}{x.dueDate ? ` · bis ${formatDay(x.dueDate)}` : ""}{x.agendaItemId ? ` · TOP ${m.agenda.findIndex((a) => a.id === x.agendaItemId) + 1}` : ""}</span>
                  <button formAction={saveAndTodo.bind(null, "delete", x.id)} aria-label={`${x.title} löschen`} className="ml-auto px-2 text-poster">✕</button>
                </li>))}</ul>
              <div className="grid gap-2 sm:grid-cols-12">
                <input name="todoTitle" maxLength={200} placeholder="Neues To-do (wird beim Speichern angelegt)" className="input sm:col-span-5" aria-label="Neues To-do" />
                <select name="todoAssignee" className="input sm:col-span-3" aria-label="Wer"><option value="">– wer –</option>{orga.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input name="todoDue" type="date" className="input sm:col-span-2" aria-label="Bis wann" min={toInput(m.date)} />
                <select name="todoAgenda" className="input sm:col-span-2" aria-label="TOP"><option value="">– TOP –</option>{m.agenda.map((a, i) => <option key={a.id} value={a.id}>TOP {i + 1}</option>)}</select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t-2 border-stone-200 pt-3">
              <button className="btn">Protokoll speichern</button>
              <PrintButton label="Drucken / PDF" />
            </div>
          </form>
          <DirtyGuard formId="protokoll" />
          <form className="mt-3 border-t-2 border-stone-200 pt-3">{hidden}
            <button formAction={finalizeProtocol.bind(null, false)} className="btn-sun">Protokoll abschließen</button>
            <span className="ml-2 text-sm text-stone-600">Danach ist es schreibgeschützt und kann verschickt werden. Vorher speichern!</span>
          </form>
        </section>
      ) : (
        <section className="card mb-4 print:hidden">
          <h2 className="mb-1">Protokoll</h2>
          <p className="mb-3 text-sm text-stone-600">Abgeschlossen am {formatDay(m.finalizedAt!)}{m.protocolSentAt ? ` · verschickt am ${formatDay(m.protocolSentAt)}` : ""}.</p>
          <div className="flex flex-wrap gap-2">
            <form>{hidden}<button formAction={sendProtocol} className="btn">{m.protocolSentAt ? "Erneut per Mail senden" : "Per Mail an alle Eingeladenen"}</button></form>
            <a href={mailtoHref(emails, `Protokoll: ${m.title}`, protocol)} className="btn-light">Mailprogramm öffnen</a>
            <PrintButton label="Drucken / PDF" />
            <form>{hidden}<button formAction={finalizeProtocol.bind(null, true)} className="btn-light">Wieder öffnen</button></form>
          </div>
        </section>
      )}

      {/* Lesefassung (auch Druckansicht) */}
      <section className={`card mb-4 print:border-0 print:p-0 print:shadow-none ${final ? "" : "hidden print:block"}`}>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{protocol}</pre>
      </section>

      {/* ---------- Termin bearbeiten ---------- */}
      <details className="card mb-4 print:hidden"><summary className="cursor-pointer font-semibold">Termin bearbeiten / löschen</summary>
        <form action={updateMeeting} className="mt-3 grid gap-2 sm:grid-cols-12"><input type="hidden" name="id" value={m.id} />
          <input name="title" defaultValue={m.title} maxLength={120} required className="input sm:col-span-12" aria-label="Titel" />
          <input type="date" name="date" defaultValue={toInput(m.date)} required className="input sm:col-span-4" aria-label="Datum" />
          <input type="time" name="startTime" defaultValue={m.startTime} required className="input sm:col-span-2" aria-label="Beginn" />
          <input type="time" name="endTime" defaultValue={m.endTime ?? ""} className="input sm:col-span-2" aria-label="Ende" />
          <input name="location" defaultValue={m.location ?? ""} maxLength={200} placeholder="Ort" className="input sm:col-span-4" aria-label="Ort" />
          <textarea name="invitationText" defaultValue={m.invitationText ?? ""} rows={3} maxLength={2000} placeholder="Text für die Einladung" className="input sm:col-span-12" aria-label="Einladungstext" />
          <p className="text-sm text-stone-600 sm:col-span-8">Nach Änderungen „Allen erneut senden“ nutzen, damit alle den neuen Stand haben.</p>
          <button className="btn-light sm:col-span-4">Speichern</button>
        </form>
        <form action={deleteMeeting} className="mt-3"><input type="hidden" name="id" value={m.id} /><button className="btn-danger">Versammlung löschen</button></form>
      </details>
    </>
  );
}
