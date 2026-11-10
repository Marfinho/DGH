"use client";
import { useRef } from "react";

/** Auswahlfeld, das sofort speichert (Server Action) – praktisch auf dem Handy. */
export function AutoSelect({ action, name, value, options, hidden, label, className = "" }: {
  action: (fd: FormData) => void | Promise<void>; name: string; value: string | number; options: { value: string | number; label: string }[];
  hidden: Record<string, string | number>; label: string; className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className={className}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select name={name} defaultValue={value} aria-label={label} onChange={() => ref.current?.requestSubmit()} className="input !min-h-[40px] !w-auto max-w-[11rem] !py-1 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </form>
  );
}
