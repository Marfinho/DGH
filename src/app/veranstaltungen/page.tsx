import Link from "next/link";
import { db } from "@/lib/db";
import { formatDay } from "@/lib/dates";
import { EVENT_LABEL, type EventStatus } from "@/lib/constants";
import { PageTitle, Progress } from "@/components/ui";

export default async function Veranstaltungen() {
  const events = await db.event.findMany({ orderBy: { date: "desc" }, include: { tasks: { select: { status: true } } } });
  return (
    <>
      <div className="flex items-center justify-between"><PageTitle>Veranstaltungen</PageTitle><Link href="/veranstaltungen/neu" className="btn">Neue Veranstaltung</Link></div>
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id}><Link href={`/veranstaltungen/${e.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-brand-600">
            <div><div className="font-semibold">{e.title}</div><div className="text-sm text-stone-600">{formatDay(e.date)}{e.location ? ` · ${e.location}` : ""} · {EVENT_LABEL[e.status as EventStatus]}</div></div>
            <Progress done={e.tasks.filter((t) => t.status === "ERLEDIGT").length} total={e.tasks.length} />
          </Link></li>
        ))}
        {!events.length && <li className="text-sm text-stone-500">Noch keine Veranstaltungen.</li>}
      </ul>
    </>
  );
}
