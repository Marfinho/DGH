import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { getUser, hasRole } from "@/lib/auth";
import { logout } from "./login/actions";
import { PwaRegister } from "@/components/pwa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dorfplaner", description: "Veranstaltungen und Infos für unsere Dorfgemeinschaft",
  manifest: "/manifest.webmanifest", icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Dorfplaner" },
};
export const viewport: Viewport = { themeColor: "#2f6b3f", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  const nav: [string, string][] = u ? [["/", "Übersicht"], ["/veranstaltungen", "Veranstaltungen"], ["/meine-aufgaben", "Meine Aufgaben"], ["/neuigkeiten", "Neuigkeiten"], ["/gruppen", "Vereine & Kontakte"], ["/muell", "Müllkalender"]] : [];
  if (u && hasRole(u, "ORGANISATOR")) nav.push(["/vorlagen", "Vorlagen"]);
  if (u && hasRole(u, "ADMIN")) nav.push(["/personen", "Personen"]);
  return (
    <html lang="de">
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">🏡 Dorfplaner</Link>
            {nav.map(([h, l]) => <Link key={h} href={h} className="text-sm text-stone-700 hover:text-brand-600">{l}</Link>)}
            {u && (
              <span className="ml-auto flex items-center gap-3 text-sm">
                <Link href="/profil" className="text-stone-600 hover:text-brand-600">{u.name}</Link>
                <form action={logout}><button className="text-stone-500 hover:text-red-700">Abmelden</button></form>
              </span>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <PwaRegister />
      </body>
    </html>
  );
}
