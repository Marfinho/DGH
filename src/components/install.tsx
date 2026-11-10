"use client";
import { useEffect, useState } from "react";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** „App installieren“: Android/Chrome zeigt den echten Installationsdialog, iPhone bekommt eine Schritt-für-Schritt-Anleitung. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [mode, setMode] = useState<"pruefen" | "installiert" | "ios" | "dialog" | "andere">("pruefen");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return setMode("installiert");
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    if (ios) setMode("ios"); else setMode("andere");
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as Prompt); setMode("dialog"); };
    const onInstalled = () => { setDone(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (done) return <p className="rounded-md bg-brand-50 p-3 font-semibold text-brand-600">Fertig! Du findest den Dorfplaner jetzt auf deinem Startbildschirm.</p>;
  if (mode === "installiert") return <p className="rounded-md bg-brand-50 p-3 font-semibold text-brand-600">Du nutzt den Dorfplaner schon als App. 👍</p>;

  return (
    <div className="space-y-3">
      {mode === "dialog" && prompt && (
        <button className="btn-sun w-full !min-h-[56px] !text-2xl" onClick={async () => { await prompt.prompt(); const r = await prompt.userChoice; if (r.outcome === "accepted") setDone(true); setPrompt(null); }}>
          App installieren
        </button>
      )}
      {mode === "ios" && (
        <ol className="list-decimal space-y-1 rounded-md border-2 border-brand-600 p-3 pl-8 text-base">
          <li>Diese Seite in <b>Safari</b> öffnen.</li>
          <li>Unten auf das <b>Teilen-Symbol</b> tippen (Quadrat mit Pfeil nach oben).</li>
          <li><b>„Zum Home-Bildschirm“</b> wählen und mit „Hinzufügen“ bestätigen.</li>
        </ol>
      )}
      {mode === "andere" && !prompt && (
        <p className="rounded-md border-2 border-brand-600 p-3 text-base">
          <b>Android (Chrome):</b> Menü <b>⋮</b> oben rechts → <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b>.<br />
          <b>Am Computer:</b> Das Installieren-Symbol in der Adressleiste anklicken.
        </p>
      )}
    </div>
  );
}
