"use client";
import { useState } from "react";

/** Optional: Standort erst nach Klick abfragen und als verborgene Felder mitschicken. */
export function GeoButton() {
  const [state, setState] = useState<{ lat: number; lng: number; acc: number } | "fehler" | "laedt" | null>(null);
  return (
    <div>
      <input type="hidden" name="lat" value={state && typeof state === "object" ? state.lat : ""} />
      <input type="hidden" name="lng" value={state && typeof state === "object" ? state.lng : ""} />
      <button type="button" className="btn-light" disabled={state === "laedt"} onClick={() => {
        if (!navigator.geolocation) return setState("fehler");
        setState("laedt");
        navigator.geolocation.getCurrentPosition((p) => setState({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }), () => setState("fehler"), { enableHighAccuracy: true, timeout: 15000 });
      }}>📍 Meinen Standort übernehmen</button>
      <p className="mt-1 text-xs text-stone-600" aria-live="polite">
        {state === "laedt" ? "Standort wird ermittelt …" : state === "fehler" ? "Standort nicht verfügbar – bitte den Ort unten beschreiben." : state ? `Standort übernommen (ca. ${state.acc} m genau).` : "Freiwillig. Der Standort wird nur mitgeschickt, wenn du hier tippst."}
      </p>
    </div>
  );
}
