"use client";
import { useEffect } from "react";

/** Warnt beim Verlassen der Seite (Neu laden, Tab schließen, Klick auf einen Link), wenn im Formular ungespeicherte Änderungen stehen. */
export function DirtyGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    let dirty = false;
    const mark = () => { dirty = true; };
    const clear = () => { dirty = false; };
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!dirty || !a || a.target === "_blank" || a.href.startsWith("mailto:") || a.hasAttribute("download") || a.pathname.endsWith(".ics")) return;
      if (!window.confirm("Im Protokoll stehen ungespeicherte Änderungen. Seite trotzdem verlassen?")) { e.preventDefault(); e.stopPropagation(); }
      else dirty = false;
    };
    form.addEventListener("input", mark); form.addEventListener("submit", clear);
    window.addEventListener("beforeunload", warn); document.addEventListener("click", onClick, true);
    return () => { form.removeEventListener("input", mark); form.removeEventListener("submit", clear); window.removeEventListener("beforeunload", warn); document.removeEventListener("click", onClick, true); };
  }, [formId]);
  return null;
}
