import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, hasRole } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { EVENT_LABEL, type EventStatus } from "@/lib/constants";
import { PageTitle, Progress } from "@/components/ui";

export default async function Veranstaltungen() {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  const events = await db.event.findMany({
    where: orga ? {} : { published: true, status: { not: "ARCHIVIERT" } },
    orderBy: { date: "desc" }, include: { tasks: { select: { status: true } }, rsvps: { where: { personId: me.id } } },
  });
  return (
    <>
      <div className="flex items-center justify-between"><PageTitle>Veranstaltungen</PageTitle>{orga && <Link href="/veranstaltungen/neu" className="btn">Neue Veranstaltung</Link>}</div>
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id}><Link href={`/veranstaltungen/${e.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-brand-600">
            <div>
              <div className="font-semibold">{e.title} {orga && !e.published && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">Entwurf</span>}</div>
              <div className="text-sm text-stone-600">{formatDay(e.date)}{e.location ? ` · ${e.location}` : ""} · {EVENT_LABEL[e.status as EventStatus]}{e.rsvps[0] ? ` · Deine Antwort: ${e.rsvps[0].status === "JA" ? "Zusage" : e.rsvps[0].status === "NEIN" ? "Absage" : "Vielleicht"}` : ""}</div>
            </div>
            {orga && <Progress done={e.tasks.filter((t) => t.status === "ERLEDIGT").length} total={e.tasks.length} />}
          </Link></li>
        ))}
        {!events.length && <li className="text-sm text-stone-500">Noch keine Veranstaltungen.</li>}
      </ul>
    </>
  );
}
