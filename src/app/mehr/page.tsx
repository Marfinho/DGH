import Link from "next/link";
import { requireUser, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { logout } from "../login/actions";

type L = [href: string, label: string];

export default async function Mehr() {
  const me = await requireUser();
  const orga = hasRole(me, "ORGANISATOR");
  // „Mein Einsatz“ nur zeigen, wenn es etwas gibt (Bewohner haben selten Aufgaben)
  const hasDuties = !orga && (await db.task.count({ where: { assigneeId: me.id, status: { not: "ERLEDIGT" } } }) + await db.helperSignup.count({ where: { personId: me.id } })) > 0;
  const groups: [string, L[]][] = [
    ["Für alle", [
      ["/kalender", "Kalender"], ["/neuigkeiten", "Neuigkeiten"], ["/umfragen", "Umfragen"], ["/brett", "Schwarzes Brett"], ["/fundbuero", "Fundbüro"],
      ["/reservierung", "Reservieren & Ausleihen"], ["/anliegen", "Anliegen & Mängel melden"], ["/gruppen", "Vereine & Kontakte"], ["/muell", "Müllkalender"],
      ...(hasDuties ? [["/meine-aufgaben", "Mein Einsatz"] as L] : []), ["/profil", "Mein Profil & Benachrichtigungen"], ["/installieren", "App aufs Handy holen"],
    ]],
  ];
  if (orga) groups.push(["Orga", [["/planung", "Planung"], ["/veranstaltungen/neu", "Neue Veranstaltung"], ["/vorlagen", "Vorlagen"], ["/archiv", "Archiv & Jahresübersicht"], ["/aushang", "Aushang drucken"]]]);
  if (hasRole(me, "ADMIN")) groups.push(["Verwaltung", [["/personen", "Personen & Zugänge"]]]);
  return (
    <>
      <PageTitle>Mehr</PageTitle>
      {groups.map(([title, links]) => (
        <section key={title} className="mb-6">
          {groups.length > 1 && <h2 className="mb-2">{title}</h2>}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map(([h, l]) => (
              <li key={h}><Link href={h} className="card flex min-h-[56px] items-center justify-between !py-3 font-display text-2xl font-bold uppercase text-brand-600 hover:bg-brand-50">{l}<span aria-hidden>›</span></Link></li>
            ))}
          </ul>
        </section>
      ))}
      <form action={logout}><button className="btn-danger w-full sm:w-auto">Abmelden</button></form>
    </>
  );
}
