import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { pushEnabled } from "@/lib/push";
import { PageTitle } from "@/components/ui";
import { createNews, togglePin, deleteNews } from "./actions";

export default async function News() {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const groups = orga ? await db.group.findMany({ orderBy: { name: "asc" } }) : [];
  const posts = await db.newsPost.findMany({ orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }], include: { author: { select: { name: true } }, group: { select: { name: true } } } });
  const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });
  return (
    <>
      <PageTitle>Neuigkeiten</PageTitle>
      {orga && (
        <form action={createNews} className="card mb-6 space-y-2">
          <input name="title" required placeholder="Überschrift" className="input" />
          <select name="groupId" className="input" aria-label="Verein" defaultValue=""><option value="">Von der Dorfgemeinschaft</option>{groups.map((g) => <option key={g.id} value={g.id}>Verein: {g.name}</option>)}</select>
          <textarea name="body" required rows={4} placeholder="Text" className="input" />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" name="pinned" /> Oben anheften</label>
            {pushEnabled() && <label className="flex items-center gap-1"><input type="checkbox" name="push" /> Push-Benachrichtigung an alle senden</label>}
            <button className="btn ml-auto">Veröffentlichen</button>
          </div>
        </form>
      )}
      <div className="space-y-3">
        {posts.map((n) => (
          <article key={n.id} className="card">
            <h2>{n.pinned && "📌 "}{n.title}</h2>
            <p className="mb-1 text-xs text-stone-500">{fmt.format(n.publishedAt)}{n.group ? ` · ${n.group.name}` : n.author ? ` · ${n.author.name}` : ""}</p>
            <p className="whitespace-pre-line text-sm">{n.body}</p>
            {orga && <div className="mt-2 flex gap-2"><form action={togglePin}><input type="hidden" name="id" value={n.id} /><button className="btn-light">{n.pinned ? "Lösen" : "Anheften"}</button></form><form action={deleteNews}><input type="hidden" name="id" value={n.id} /><button className="btn-danger">Löschen</button></form></div>}
          </article>
        ))}
        {!posts.length && <p className="text-sm text-stone-500">Noch keine Neuigkeiten.</p>}
      </div>
    </>
  );
}
