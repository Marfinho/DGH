import { TASK_LABEL, type TaskStatus } from "@/lib/constants";

const badge = "inline-block rounded px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wide";
const cls: Record<string, string> = {
  OFFEN: "border-2 border-brand-600 text-brand-600",
  IN_ARBEIT: "bg-sun text-ink",
  ERLEDIGT: "bg-brand-600 text-white",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`${badge} ${cls[status] ?? cls.OFFEN}`}>{status === "ERLEDIGT" ? "✓ " : ""}{TASK_LABEL[status as TaskStatus] ?? status}</span>;
}
export const OverdueBadge = () => <span className={`${badge} bg-poster text-white`}>Überfällig</span>;

export function Progress({ done, total, onDark }: { done: number; total: number; onDark?: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${onDark ? "text-white" : "text-stone-600"}`}>
      <div className={`h-4 w-28 overflow-hidden rounded border-2 ${onDark ? "border-white" : "border-brand-600"}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${onDark ? "bg-sun" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
      </div>
      {done}/{total} erledigt
    </div>
  );
}

export const PageTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-5 flex items-center gap-3"><span className="h-9 w-2.5 shrink-0 bg-sun" aria-hidden /><h1>{children}</h1></div>
);

/** Roter Kopfbereich einer Veranstaltung (Plakat-Look). */
export function EventHero({ kicker, title, right, children }: { kicker: string; title: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-[10px] bg-poster p-5 text-white md:p-6">
      <div className="font-display text-base font-bold uppercase tracking-[0.15em] text-sun">{kicker}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="!text-white text-5xl md:text-6xl">{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}
