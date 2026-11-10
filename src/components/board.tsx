import { db } from "@/lib/db";
import { hasRole, type User } from "@/lib/auth";
import { BOARD_CATEGORIES, CATEGORY_LABEL, KINDS, kindLabel, contactHref, defaultDays, type BoardCategory } from "@/lib/board";
import { createPost, toggleDone, renewPost, deletePost, reportPost, dismissReport } from "@/app/brett/actions";

const when = (d: Date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(d);

/** Gemeinsame Ansicht für Schwarzes Brett (mehrere Kategorien) und Fundbüro (eine Kategorie). */
export async function BoardView({ me, categories, active, fehler, base }: { me: User; categories: BoardCategory[]; active?: string; fehler?: string; base: string }) {
  const orga = hasRole(me, "ORGANISATOR");
  const cat = categories.includes(active as BoardCategory) ? (active as BoardCategory) : null;
  const now = new Date();
  const posts = await db.boardPost.findMany({
    where: { category: cat ? cat : { in: categories }, OR: [{ expiresAt: { gt: now } }, { authorId: me.id }, ...(orga ? [{}] : [])] },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { author: { select: { name: true } }, photos: true },
  });
  const fixed = categories.length === 1 ? categories[0] : null;
  return (
    <>
      {fehler && <p role="alert" className="mb-4 rounded-md bg-sun p-3 font-semibold">{fehler}</p>}
      {categories.length > 1 && (
        <nav aria-label="Kategorien" className="mb-4 flex flex-wrap gap-2">
          {[null, ...categories].map((c) => (
            <a key={c ?? "alle"} href={c ? `${base}?kat=${c}` : base} aria-current={cat === c ? "true" : undefined}
              className={`rounded-md border-2 px-3 py-1.5 font-display text-base font-bold uppercase tracking-wide ${cat === c ? "border-brand-600 bg-brand-600 text-white" : "border-brand-600 text-brand-600 hover:bg-brand-50"}`}>{c ? CATEGORY_LABEL[c] : "Alle"}</a>
          ))}
        </nav>
      )}

      <details className="card mb-6"><summary className="font-display text-2xl font-extrabold uppercase text-brand-600">+ Neuer Beitrag</summary>
        <form action={createPost} className="mt-3 grid gap-3 sm:grid-cols-2">
          {fixed ? <input type="hidden" name="category" value={fixed} /> : (
            <div><label className="label">Kategorie</label><select name="category" className="input" defaultValue={cat ?? "ALLGEMEIN"}>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></div>
          )}
          <div><label className="label">Art</label><select name="kind" className="input">{KINDS.map((k) => <option key={k} value={k}>{fixed ? kindLabel(fixed, k) : k === "BIETE" ? "Ich biete / verleihe / helfe / fahre" : "Ich suche / brauche"}</option>)}</select>
            </div>
          <div className="sm:col-span-2"><label className="label">Überschrift</label><input name="title" required minLength={3} maxLength={120} className="input" placeholder={fixed === "FUNDBUERO" ? "z. B. Schlüsselbund am Dorfplatz gefunden" : "z. B. Fahrt zum Wochenmarkt jeden Samstag"} /></div>
          <div className="sm:col-span-2"><label className="label">Beschreibung</label><textarea name="body" required minLength={3} maxLength={2000} rows={4} className="input" /></div>
          <div><label className="label">Kontakt (freiwillig – erscheint für alle Angemeldeten)</label><input name="contact" maxLength={200} className="input" placeholder="Telefon oder E-Mail" /></div>
          <div><label className="label">Foto (freiwillig)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="input !p-1.5" /></div>
          <div><label className="label">Sichtbar für</label><select name="days" className="input" defaultValue={defaultDays(fixed ?? "ALLGEMEIN")}><option value="14">14 Tage</option><option value="30">30 Tage</option><option value="60">60 Tage</option><option value="120">120 Tage</option></select></div>
          <div className="flex items-end"><button className="btn w-full sm:w-auto">Veröffentlichen</button></div>
          <p className="text-xs text-stone-500 sm:col-span-2">Dein Name erscheint beim Beitrag. Fotos werden verkleinert, Standortdaten darin entfernt. Bitte keine Daten Dritter ohne deren Einverständnis veröffentlichen.</p>
        </form>
      </details>

      <ul className="space-y-4">
        {posts.map((p) => { const own = p.authorId === me.id, expired = p.expiresAt <= now, href = p.contact ? contactHref(p.contact) : null;
          return (
            <li key={p.id} className={`card ${p.status === "ERLEDIGT" || expired ? "opacity-70" : ""}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wide ${p.kind === "BIETE" ? "bg-brand-600 text-white" : "bg-sun text-ink"}`}>{kindLabel(p.category, p.kind)}</span>
                {categories.length > 1 && <span className="rounded border-2 border-stone-300 px-1.5 text-xs font-bold uppercase text-stone-600">{CATEGORY_LABEL[p.category as BoardCategory]}</span>}
                {p.status === "ERLEDIGT" && <span className="rounded bg-stone-300 px-2 py-0.5 text-xs font-bold uppercase">Erledigt</span>}
                {expired && <span className="rounded bg-stone-300 px-2 py-0.5 text-xs font-bold uppercase">Abgelaufen</span>}
                {orga && p.reportedAt && <span className="rounded bg-poster px-2 py-0.5 text-xs font-bold uppercase text-white">Gemeldet</span>}
              </div>
              <h3 className="text-2xl uppercase text-brand-600">{p.title}</h3>
              <p className="whitespace-pre-line">{p.body}</p>
              {p.photos[0] && <a href={`/api/photos/${p.photos[0].id}`} target="_blank" rel="noopener"><img src={`/api/photos/${p.photos[0].id}`} alt={`Foto zu: ${p.title}`} loading="lazy" className="mt-2 max-h-72 rounded-md border-2 border-stone-300" /></a>}
              {p.contact && <p className="mt-2 font-semibold">Kontakt: {href ? <a href={href} className="text-brand-600 underline">{p.contact}</a> : p.contact}</p>}
              <p className="mt-1 text-xs text-stone-500">{p.author.name} · {when(p.createdAt)} · sichtbar bis {when(p.expiresAt)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(own || orga) && <form action={toggleDone}><input type="hidden" name="id" value={p.id} /><button className="btn-light !min-h-[40px]">{p.status === "OFFEN" ? "Als erledigt markieren" : "Wieder öffnen"}</button></form>}
                {(own || orga) && expired && <form action={renewPost}><input type="hidden" name="id" value={p.id} /><button className="btn-light !min-h-[40px]">Verlängern</button></form>}
                {(own || orga) && <form action={deletePost}><input type="hidden" name="id" value={p.id} /><button className="btn-danger !min-h-[40px]">Löschen</button></form>}
                {!own && !p.reportedAt && <form action={reportPost}><input type="hidden" name="id" value={p.id} /><button className="px-2 text-sm font-semibold text-stone-500 underline">Melden</button></form>}
                {orga && p.reportedAt && <form action={dismissReport}><input type="hidden" name="id" value={p.id} /><button className="btn-light !min-h-[40px]">Meldung ablehnen</button></form>}
              </div>
            </li>
          ); })}
        {!posts.length && <li className="text-stone-600">Noch nichts da. Sei die oder der Erste!</li>}
      </ul>
    </>
  );
}
