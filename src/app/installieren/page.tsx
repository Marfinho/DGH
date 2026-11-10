import Link from "next/link";
import QRCode from "qrcode";
import { getUser, appUrl } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { InstallButton } from "@/components/install";

export const metadata = { title: "Dorfplaner aufs Handy holen" };

// Öffentliche Seite: Ziel des Buttons auf der Dorf-Website und des QR-Codes (Flyer, Aushang)
export default async function Installieren() {
  const u = await getUser();
  const url = `${appUrl()}/installieren`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#0B4F2A", light: "#FFFFFF" } });
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle>Dorfplaner aufs Handy holen</PageTitle>
      <p className="mb-4 text-lg">Alle Veranstaltungen, Aufgaben, Neuigkeiten und der Müllkalender unserer Dorfgemeinschaft – immer griffbereit, ohne App-Store.</p>

      <section className="card mb-5">
        <h2 className="mb-3">1. Auf den Startbildschirm</h2>
        <InstallButton />
      </section>

      <section className="card mb-5">
        <h2 className="mb-3">2. Anmelden</h2>
        {u ? (
          <p className="mb-3">Du bist angemeldet als <b>{u.name}</b>.</p>
        ) : (
          <p className="mb-3">Du brauchst einen <b>Einladungscode</b> vom Orga-Team (einmalig). Danach bleibst du angemeldet – oder bekommst bei Bedarf einen Anmelde-Link per E-Mail.</p>
        )}
        <Link href={u ? "/" : "/login"} className="btn w-full !min-h-[52px] !text-xl">{u ? "Zum Dorfplaner" : "Zur Anmeldung"}</Link>
      </section>

      <section className="card text-center">
        <h2 className="mb-2">Per QR-Code weitergeben</h2>
        <div className="mx-auto h-48 w-48" role="img" aria-label="QR-Code zur Installationsseite" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-2 text-sm text-stone-600">Mit der Handy-Kamera scannen. Zum Ausdrucken: <a href="/installieren/qr.svg" className="font-semibold text-brand-600 underline">QR-Code als Grafik</a></p>
      </section>
    </div>
  );
}
