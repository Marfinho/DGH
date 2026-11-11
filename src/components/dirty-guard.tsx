"use client";
import { useEffect } from "react";

/** Warnt beim Verlassen der Seite, wenn im Formular ungespeicherte Änderungen stehen. */
export function DirtyGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    let dirty = false;
    const mark = () => { dirty = true; };
    const clear = () => { dirty = false; };
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    form.addEventListener("input", mark); form.addEventListener("submit", clear); window.addEventListener("beforeunload", warn);
    return () => { form.removeEventListener("input", mark); form.removeEventListener("submit", clear); window.removeEventListener("beforeunload", warn); };
  }, [formId]);
  return null;
}
