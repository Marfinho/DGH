import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, hasRole, appUrl } from "@/lib/auth";
import { ISSUE_CATEGORY_LABEL, ISSUE_STATUS, ISSUE_STATUS_LABEL, osmLink, municipalityMailto } from "@/lib/issues";
import { PageTitle } from "@/components/ui";
import { updateIssue, deleteIssue } from "../actions";

const when = (d: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(d);

export default async function AnliegenDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const i = await db.issue.findUnique({ where: { id: Number((await params).id) }, include: { author: true, photos: true } });
  if (!i || (!orga && i.authorId !== me.id && !i.isPublic)) notFound();
  const { neu } = await searchParams;
  const own = i.authorId === me.id;
  const mail = process.env.MUNICIPALITY_EMAIL;
  const showMap = (orga || own) && i.lat != null && i.lng != null;
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/anliegen" className="font-semibold text-brand-600 hover:underline">← Alle Anliegen</Link></p>
      <PageTitle>{i.title}</PageTitle>
      {neu && <p className="mb-4 rounded-md bg-brand-50 p-3 font-semibold text-brand-600">Danke, dein Anliegen ist angekommen. Du bekommst Bescheid, wenn sich etwas tut.</p>}
      <div className="card mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded bg-brand-600 px-2 py-0.5 font-display text-sm font-bold uppercase text-white">{ISSUE_STATUS_LABEL[i.status]}</span><span className="rounded border-2 border-stone-300 px-1.5 text-xs font-bold uppercase text-stone-600">{ISSUE_CATEGORY_LABEL[i.category]}</span></div>
        <p className="whitespace-pre-line">{i.description}</p>
        {i.locationText && <p className="mt-2"><b>Ort:</b> {i.locationText}</p>}
        {showMap && <p><a href={osmLink(i.lat!, i.lng!)} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">📍 Auf der Karte öffnen (OpenStreetMap)</a></p>}
        {i.photos[0] && <img src={`/api/photos/${i.photos[0].id}`} alt={`Foto zu: ${i.title}`} className="mt-3 max-h-96 rounded-md border-2 border-stone-300" />}
        <p className="mt-2 text-xs text-stone-500">Gemeldet von {i.author.name} am {when(i.createdAt)}{i.forwardedAt ? ` · an die Gemeinde weitergeleitet am ${when(i.forwardedAt)}` : ""}</p>
      </div>
      {i.response && <div className="card mb-4 !border-sun !shadow-[5px_5px_0_#FFCA01]"><h2 className="mb-1">Antwort der Orga</h2><p className="whitespace-pre-line">{i.response}</p></div>}

      {orga && (
        <form action={updateIssue} className="card mb-4 space-y-3"><input type="hidden" name="id" value={i.id} /><h2>Bearbeiten (Orga)</h2>
          <div><label className="label">Status</label><select name="status" defaultValue={i.status} className="input">{ISSUE_STATUS.map((s) => <option key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</option>)}</select></div>
          <div><label className="label">Antwort an die meldende Person</label><textarea name="response" defaultValue={i.response ?? ""} rows={3} className="input" /></div>
          <label className="flex min-h-[44px] items-center gap-2 font-semibold"><input type="checkbox" name="isPublic" defaultChecked={i.isPublic} className="h-5 w-5" /> Für alle Bewohner sichtbar</label>
          <div className="flex flex-wrap gap-2"><button className="btn">Speichern &amp; Person benachrichtigen</button>
            {mail ? <a href={municipalityMailto(mail, i, appUrl())} className="btn-sun">✉ E-Mail an die Gemeinde vorbereiten</a> : <span className="self-center text-sm text-stone-500">Tipp: <code>MUNICIPALITY_EMAIL</code> in der .env setzen, dann gibt es hier eine vorbereitete E-Mail an die Gemeinde.</span>}</div>
          <p className="text-xs text-stone-500">Die E-Mail öffnet dein Mailprogramm – es wird nichts automatisch versendet. Setze danach den Status auf „An Gemeinde weitergeleitet“.</p>
        </form>
      )}
      {(orga || (own && i.status === "NEU")) && <form action={deleteIssue}><input type="hidden" name="id" value={i.id} /><button className="btn-danger">Anliegen löschen</button></form>}
    </>
  );
}
