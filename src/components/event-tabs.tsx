import Link from "next/link";

export type EventTab = "aufgaben" | "ablauf" | "material" | "budget";
const TABS: [EventTab, string, string][] = [["aufgaben", "Aufgaben", ""], ["ablauf", "Ablaufplan", "/ablauf"], ["material", "Material", "/material"], ["budget", "Budget", "/budget"]];

/** Reiter der Orga-Ansicht einer Veranstaltung. */
export function EventTabs({ id, active, counts = {} }: { id: number; active: EventTab; counts?: Partial<Record<EventTab, string>> }) {
  return (
    <nav aria-label="Bereiche der Veranstaltung" className="mb-4 flex gap-1 overflow-x-auto border-b-4 border-brand-600 print:hidden">
      {TABS.map(([k, label, path]) => (
        <Link key={k} href={`/veranstaltungen/${id}${path}`} aria-current={k === active ? "page" : undefined}
          className={`shrink-0 rounded-t-md px-3 py-2 font-display text-lg font-bold uppercase tracking-wide ${k === active ? "bg-brand-600 text-white" : "text-brand-600 hover:bg-brand-50"}`}>
          {label}{counts[k] && <span className="ml-1.5 text-sm opacity-80">{counts[k]}</span>}
        </Link>
      ))}
    </nav>
  );
}
