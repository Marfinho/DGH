import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/kaushan-script/latin-400.css";
import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { getUser, hasRole } from "@/lib/auth";
import { logout } from "./login/actions";
import { PwaRegister } from "@/components/pwa";
import { TopNav, BottomNav, type NavItem } from "@/components/nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dorfplaner · Dorfgemeinschaft Haste", description: "Veranstaltungen und Infos für unsere Dorfgemeinschaft",
  manifest: "/manifest.webmanifest", icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Dorfplaner" },
};
export const viewport: Viewport = { themeColor: "#0B4F2A", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  // Hauptpunkte (Handy: Tab-Leiste, Rest unter „Mehr“)
  const main: NavItem[] = [{ href: "/", label: "Start" }, { href: "/veranstaltungen", label: "Termine" }, { href: "/meine-aufgaben", label: "Aufgaben" }];
  const more: NavItem[] = [{ href: "/neuigkeiten", label: "Neuigkeiten" }, { href: "/gruppen", label: "Vereine & Kontakte" }, { href: "/muell", label: "Müllkalender" }];
  if (u && hasRole(u, "ORGANISATOR")) more.push({ href: "/vorlagen", label: "Vorlagen" });
  if (u && hasRole(u, "ADMIN")) more.push({ href: "/personen", label: "Personen" });
  return (
    <html lang="de">
      <body className="min-h-screen">
        <header className="border-b-4 border-brand-600 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
            <Link href="/" aria-label="Dorfplaner Startseite" className="shrink-0">
              <img src="/logo.png" alt="Dorfgemeinschaft Haste" width={770} height={220} className="h-10 w-auto md:h-12" />
            </Link>
            {u && <TopNav items={[...main, ...more]} />}
            {u && (
              <span className="ml-auto flex items-center gap-3 text-sm font-semibold">
                <Link href="/profil" className="hidden text-ink hover:text-brand-600 sm:inline">{u.name}</Link>
                <form action={logout}><button className="rounded-md border-2 border-brand-600 px-3 py-1.5 font-display text-base font-bold uppercase text-brand-600 hover:bg-brand-50">Abmelden</button></form>
              </span>
            )}
          </div>
        </header>
        <main className={`mx-auto max-w-6xl px-4 py-6 ${u ? "pb-28 md:pb-10" : ""}`}>{children}</main>
        {u && <BottomNav items={main} />}
        <PwaRegister />
      </body>
    </html>
  );
}
