import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dorfplaner", description: "Veranstaltungsplanung für unsere Dorfgemeinschaft" };

const nav = [["/", "Übersicht"], ["/veranstaltungen", "Veranstaltungen"], ["/vorlagen", "Vorlagen"], ["/personen", "Personen"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">🏡 Dorfplaner</Link>
            {nav.map(([h, l]) => <Link key={h} href={h} className="text-sm text-stone-700 hover:text-brand-600">{l}</Link>)}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
