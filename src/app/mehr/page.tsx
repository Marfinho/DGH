import Link from "next/link";
import { requireUser, hasRole } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { logout } from "../login/actions";

export default async function Mehr() {
  const me = await requireUser();
  const links: [string, string][] = [["/neuigkeiten", "Neuigkeiten"], ["/gruppen", "Vereine & Kontakte"], ["/muell", "Müllkalender"], ["/fundbuero", "Fundbüro"], ["/anliegen", "Anliegen & Mängel melden"], ["/profil", "Mein Profil"]];
  if (hasRole(me, "ORGANISATOR")) links.push(["/vorlagen", "Vorlagen"], ["/archiv", "Archiv & Jahresübersicht"], ["/aushang", "Aushang drucken"]);
  if (hasRole(me, "ADMIN")) links.push(["/personen", "Personen & Zugänge"]);
  return (
    <>
      <PageTitle>Mehr</PageTitle>
      <ul className="space-y-3">
        {links.map(([h, l]) => (
          <li key={h}><Link href={h} className="card flex min-h-[56px] items-center justify-between !py-3 font-display text-2xl font-bold uppercase text-brand-600">{l}<span aria-hidden>›</span></Link></li>
        ))}
        <li><form action={logout}><button className="btn-danger w-full">Abmelden</button></form></li>
      </ul>
    </>
  );
}
