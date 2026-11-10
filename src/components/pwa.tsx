"use client";
import { useEffect, useState } from "react";

export function PwaRegister() {
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);
  return null;
}

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<"unbekannt" | "aus" | "an" | "nicht-unterstuetzt" | "blockiert">("unbekannt");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("nicht-unterstuetzt");
    if (Notification.permission === "denied") return setState("blockiert");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? "an" : "aus"));
  }, []);
  async function on() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState("blockiert");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapidKey) });
    await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    setState("an");
  }
  async function off() {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) { await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setState("aus");
  }
  if (state === "nicht-unterstuetzt") return <p className="text-sm text-stone-500">Dieses Gerät/Browser unterstützt keine Push-Benachrichtigungen (auf dem iPhone: App erst zum Home-Bildschirm hinzufügen).</p>;
  if (state === "blockiert") return <p className="text-sm text-amber-700">Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Seiteneinstellungen.</p>;
  return state === "an"
    ? <button onClick={off} className="btn-light">🔕 Benachrichtigungen auf diesem Gerät ausschalten</button>
    : <button onClick={on} className="btn" disabled={state === "unbekannt"}>🔔 Benachrichtigungen aktivieren</button>;
}
