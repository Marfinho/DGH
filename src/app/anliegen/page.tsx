import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { ISSUE_CATEGORIES, ISSUE_CATEGORY_LABEL, ISSUE_STATUS, ISSUE_STATUS_LABEL } from "@/lib/issues";
import { PageTitle } from "@/components/ui";
import { GeoButton } from "@/components/geo";
import { createIssue } from "./actions";

const when = (d: Date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(d);
const tone: Record<string, string> = { NEU: "bg-sun text-ink", IN_BEARBEITUNG: "bg-brand-600 text-white", WEITERGELEITET: "bg-brand-600 text-white", ERLEDIGT: "bg-stone-300 text-ink", ABGELEHNT: "bg-poster text-white" };

export default async function Anliegen({ searchParams }: { searchParams: Promise<{ status?: string; fehler?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const { status, fehler } = await searchParams;
  const st = ISSUE_STATUS.includes(status as never) ? status : undefined;
  const issues = await db.issue.findMany({
    where: { ...(st ? { status: st } : {}), ...(orga ? {} : { OR: [{ authorId: me.id }, { isPublic: true }] }) },
    orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } },
  });
  return (
    <>
      <PageTitle>Anliegen &amp; Mängel melden</PageTitle>
      <p className="mb-4 text-stone-600">Kaputte Laterne, Schlagloch, vollgemüllter Platz? Melde es hier mit Foto – die Orga kümmert sich oder leitet es an die Gemeinde weiter.</p>
      {fehler && <p role="alert" className="mb-4 rounded-md bg-sun p-3 font-semibold">{fehler}</p>}

      <details className="card mb-6" open={!issues.length}><summary className="font-display text-2xl font-extrabold uppercase text-brand-600">+ Neues Anliegen melden</summary>
        <form action={createIssue} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="label">Worum geht es?</label><select name="category" className="input">{ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{ISSUE_CATEGORY_LABEL[c]}</option>)}</select></div>
          <div><label className="label">Kurz beschrieben</label><input name="title" required minLength={3} maxLength={120} className="input" placeholder="z. B. Laterne Hauptstraße 12 defekt" /></div>
          <div className="sm:col-span-2"><label className="label">Beschreibung</label><textarea name="description" required minLength={3} maxLength={3000} rows={4} className="input" /></div>
          <div><label className="label">Ort / Adresse</label><input name="locationText" maxLength={200} className="input" placeholder="z. B. Kreuzung Dorfstraße / Mühlweg" /></div>
          <div><label className="label">Foto (freiwillig)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="input !p-1.5" /></div>
          <div className="sm:col-span-2"><GeoButton /></div>
          <label className="flex min-h-[44px] items-center gap-2 font-semibold sm:col-span-2"><input type="checkbox" name="isPublic" className="h-5 w-5" /> Für alle Bewohner sichtbar machen (hilft, Doppelmeldungen zu vermeiden)</label>
          <div className="sm:col-span-2"><button className="btn w-full sm:w-auto">Anliegen absenden</button></div>
          <p className="text-xs text-stone-500 sm:col-span-2">Deine Meldung sehen du und das Orga-Team. Fotos werden verkleinert und von Standortdaten befreit.</p>
        </form>
      </details>

      {orga && (
        <nav aria-label="Status" className="mb-4 flex flex-wrap gap-2">
          {[undefined, ...ISSUE_STATUS].map((s) => (
            <Link key={s ?? "alle"} href={s ? `/anliegen?status=${s}` : "/anliegen"} className={`rounded-md border-2 px-3 py-1.5 font-display text-base font-bold uppercase tracking-wide ${st === s ? "border-brand-600 bg-brand-600 text-white" : "border-brand-600 text-brand-600 hover:bg-brand-50"}`}>{s ? ISSUE_STATUS_LABEL[s] : "Alle"}</Link>
          ))}
        </nav>
      )}

      <ul className="space-y-3">
        {issues.map((i) => (
          <li key={i.id}><Link href={`/anliegen/${i.id}`} className="card block hover:bg-brand-50">
            <div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wide ${tone[i.status]}`}>{ISSUE_STATUS_LABEL[i.status]}</span>
              <span className="rounded border-2 border-stone-300 px-1.5 text-xs font-bold uppercase text-stone-600">{ISSUE_CATEGORY_LABEL[i.category]}</span>{i.isPublic && <span className="text-xs font-semibold text-stone-500">öffentlich</span>}</div>
            <div className="font-display text-2xl font-extrabold uppercase text-brand-600">{i.title}</div>
            <div className="text-sm text-stone-600">{when(i.createdAt)} · {i.author.name}{i.locationText ? ` · ${i.locationText}` : ""}</div>
          </Link></li>
        ))}
        {!issues.length && <li className="text-stone-600">Keine Anliegen{st ? " mit diesem Status" : ""}.</li>}
      </ul>
    </>
  );
}
