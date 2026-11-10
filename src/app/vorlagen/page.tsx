import Link from "next/link";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { createTemplate } from "./actions";

export default async function Vorlagen() {
  const list = await db.template.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tasks: true, milestones: true } } } });
  return (
    <>
      <PageTitle>Vorlagen</PageTitle>
      <form action={createTemplate} className="card mb-6 flex items-end gap-3">
        <div className="flex-1"><label className="label">Neue leere Vorlage</label><input name="name" required placeholder="z. B. Sommerfest" className="input" /></div>
        <button className="btn">Anlegen</button>
      </form>
      <ul className="space-y-2">
        {list.map((t) => (
          <li key={t.id}><Link href={`/vorlagen/${t.id}`} className="card block hover:border-brand-600">
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-stone-600">{t._count.milestones} Meilensteine · {t._count.tasks} Aufgaben</div>
          </Link></li>
        ))}
        {!list.length && <li className="text-sm text-stone-500">Noch keine Vorlagen. Du kannst auch eine Veranstaltung nach dem Event als Vorlage speichern.</li>}
      </ul>
    </>
  );
}
