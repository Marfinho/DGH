import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { pushEnabled } from "@/lib/push";
import { today, formatDay, toInput } from "@/lib/dates";
import { isOpen, tally } from "@/lib/polls";
import { PageTitle } from "@/components/ui";
import { createPoll, vote, withdrawVote, closePoll, deletePoll } from "./actions";

export default async function Umfragen({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const { fehler } = await searchParams;
  const t = today();
  const polls = await db.poll.findMany({
    orderBy: { createdAt: "desc" }, take: 50,
    include: { options: { orderBy: { sort: "asc" } }, votes: { select: { optionId: true, personId: true } }, createdBy: { select: { name: true } } },
  });
  const open = polls.filter((p) => isOpen(p, t)), done = polls.filter((p) => !isOpen(p, t));

  const card = (p: (typeof polls)[number]) => {
    const active = isOpen(p, t);
    const mine = new Set(p.votes.filter((v) => v.personId === me.id).map((v) => v.optionId));
    const voted = mine.size > 0;
    const showResults = voted || !active || orga;
    const { rows, participants } = tally(p.options.map((o) => o.id), p.votes);
    const byId = new Map(rows.map((r) => [r.optionId, r]));
    return (
      <article key={p.id} id={`u${p.id}`} className="card scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2>{p.title}</h2>
          <span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase ${active ? "bg-sun text-ink" : "bg-stone-200 text-stone-700"}`}>{active ? (p.closesOn ? `bis ${formatDay(p.closesOn)}` : "läuft") : "beendet"}</span>
        </div>
        {p.description && <p className="mb-2 whitespace-pre-line text-sm text-stone-700">{p.description}</p>}
        <p className="mb-3 text-xs text-stone-500">{p.multiple ? "Mehrere Antworten möglich" : "Eine Antwort"} · {participants} {participants === 1 ? "Person hat" : "Personen haben"} abgestimmt{p.createdBy ? ` · von ${p.createdBy.name}` : ""}</p>
        {active ? (
          <form action={vote} className="space-y-2">
            <input type="hidden" name="pollId" value={p.id} />
            {p.options.map((o) => { const r = byId.get(o.id)!; return (
              <label key={o.id} className={`relative flex min-h-[48px] cursor-pointer items-center gap-3 overflow-hidden rounded-md border-2 px-3 py-2 ${mine.has(o.id) ? "border-brand-600" : "border-stone-300"}`}>
                {showResults && <span aria-hidden className="absolute inset-y-0 left-0 bg-brand-50" style={{ width: `${r.pct}%` }} />}
                <input type={p.multiple ? "checkbox" : "radio"} name="optionId" value={o.id} defaultChecked={mine.has(o.id)} required={!p.multiple} className="relative h-5 w-5 accent-[#0B4F2A]" />
                <span className="relative font-semibold">{o.text}</span>
                {showResults && <span className="relative ml-auto text-sm font-bold text-stone-700">{r.count} · {r.pct} %</span>}
              </label>
            ); })}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button className="btn">{voted ? "Stimme ändern" : "Abstimmen"}</button>
              {voted && <button formAction={withdrawVote} formNoValidate className="btn-light">Stimme zurückziehen</button>}
              {!showResults && <span className="text-sm text-stone-500">Ergebnis siehst du nach deiner Abstimmung.</span>}
            </div>
          </form>
        ) : (
          <ul className="space-y-2">
            {p.options.map((o) => { const r = byId.get(o.id)!; return (
              <li key={o.id} className={`relative flex min-h-[44px] items-center overflow-hidden rounded-md border-2 px-3 py-2 ${r.top ? "border-brand-600" : "border-stone-300"}`}>
                <span aria-hidden className={`absolute inset-y-0 left-0 ${r.top ? "bg-sun/60" : "bg-brand-50"}`} style={{ width: `${r.pct}%` }} />
                <span className="relative font-semibold">{r.top && "🏆 "}{o.text}{mine.has(o.id) && <span className="ml-2 text-xs font-normal text-stone-600">(deine Wahl)</span>}</span>
                <span className="relative ml-auto text-sm font-bold">{r.count} · {r.pct} %</span>
              </li>
            ); })}
          </ul>
        )}
        {orga && (
          <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-stone-200 pt-3">
            <form action={closePoll}><input type="hidden" name="id" value={p.id} /><button className="btn-light">{active ? "Jetzt beenden" : "Wieder öffnen"}</button></form>
            <form action={deletePoll}><input type="hidden" name="id" value={p.id} /><button className="btn-danger">Löschen</button></form>
          </div>
        )}
      </article>
    );
  };

  return (
    <>
      <PageTitle>Umfragen</PageTitle>
      <p className="mb-4 text-stone-600">Deine Meinung zählt: Termine finden, Ideen auswählen, Stimmungsbild einholen. Es werden nur Summen angezeigt – niemand sieht, wer wie abgestimmt hat.</p>
      {fehler && <p role="alert" className="mb-4 rounded bg-amber-50 p-2 text-sm text-amber-800">{fehler}</p>}
      {orga && (
        <details className="card mb-6">
          <summary className="cursor-pointer font-display text-xl font-bold uppercase text-brand-600">Neue Umfrage</summary>
          <form action={createPoll} className="mt-3 space-y-2">
            <input name="title" required minLength={3} maxLength={200} placeholder="Frage, z. B. „Wann soll das Sommerfest stattfinden?“" className="input" />
            <textarea name="description" rows={2} maxLength={2000} placeholder="Erläuterung (optional)" className="input" />
            <label className="label" htmlFor="opts">Antworten – eine pro Zeile</label>
            <textarea id="opts" name="options" required rows={4} placeholder={"Samstag, 20. Juni\nSonntag, 21. Juni\nSamstag, 27. Juni"} className="input" />
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="label" htmlFor="closes">Letzter Abstimmungstag (optional)</label><input id="closes" type="date" name="closesOn" min={toInput(t)} className="input" /></div>
              <div className="flex flex-col justify-end gap-1 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="multiple" /> Mehrere Antworten erlauben</label>
                {pushEnabled() && <label className="flex items-center gap-2"><input type="checkbox" name="push" /> Push-Benachrichtigung an alle senden</label>}
              </div>
            </div>
            <button className="btn">Umfrage starten</button>
          </form>
        </details>
      )}
      <div className="space-y-4">{open.map(card)}</div>
      {!open.length && <p className="text-sm text-stone-500">Gerade läuft keine Umfrage.</p>}
      {done.length > 0 && <><h2 className="mb-3 mt-8">Beendet</h2><div className="space-y-4">{done.map(card)}</div></>}
    </>
  );
}
