import { TASK_LABEL, type TaskStatus } from "@/lib/constants";

const cls: Record<string, string> = {
  OFFEN: "bg-stone-100 text-stone-700",
  IN_ARBEIT: "bg-amber-100 text-amber-800",
  ERLEDIGT: "bg-green-100 text-green-800",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? cls.OFFEN}`}>{TASK_LABEL[status as TaskStatus] ?? status}</span>;
}

export function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-stone-600">
      <div className="h-2 w-28 overflow-hidden rounded bg-stone-200"><div className="h-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
      {done}/{total} erledigt
    </div>
  );
}

export const PageTitle = ({ children }: { children: React.ReactNode }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>;
