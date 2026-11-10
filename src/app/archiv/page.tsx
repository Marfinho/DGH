import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { today, formatDay } from "@/lib/dates";
import { summarize } from "@/lib/budget";
import { formatMoney } from "@/lib/money";
import { PageTitle } from "@/components/ui";

const signed = (c: number) => `${c > 0 ? "+" : ""}${formatMoney(c)}`;

export default async function Archiv({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  await requireUser("ORGANISATOR");
  const t0 = today();
  const { jahr } = await searchParams;
  const events = await db.event.findMany({
    where: { OR: [{ status: { in: ["DURCHGEFUEHRT", "ARCHIVIERT"] } }, { date: { lt: t0 } }] }, orderBy: { date: "desc" },
    include: { template: true, tasks: { select: { status: true } }, budgetItems: true, rsvps: { where: { status: "JA" } }, slots: { include: { _count: { select: { signups: true } } } } },
  });
  const rows = events.map((e) => {
    const b = summarize(e.budgetItems, e.budgetCents);
    const guests = e.rsvps.reduce((a, r) => a + 1 + r.guests, 0);
    const helpers = e.slots.reduce((a, s) => a + s._count.signups, 0);
    const done = e.tasks.filter((x) => x.status === "ERLEDIGT").length;
    return { e, b, guests, helpers, done, total: e.tasks.length, year: e.date.getUTCFullYear() };
  });
  type Row = (typeof rows)[number];
  // Vorgänger: letzte frühere Veranstaltung derselben Vorlage
  const prev = (r: Row): Row | undefined => (r.e.templateId ? rows.filter((x) => x.e.templateId === r.e.templateId && x.e.date < r.e.date).sort((a, c) => +c.e.date - +a.e.date)[0] : undefined);

  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  const sel = years.includes(Number(jahr)) ? Number(jahr) : years[0];
  const yr = years.map((y) => { const rs = rows.filter((r) => r.year === y); return { y, n: rs.length, exp: rs.reduce((a, r) => a + r.b.expectedExpense, 0), inc: rs.reduce((a, r) => a + r.b.expectedIncome, 0), guests: rs.reduce((a, r) => a + r.guests, 0), helpers: rs.reduce((a, r) => a + r.helpers, 0) }; });
  const shown = rows.filter((r) => r.year === sel);

  return (
    <>
      <PageTitle>Archiv &amp; Jahresübersicht</PageTitle>
      {!rows.length && <p className="text-stone-600">Noch keine vergangenen Veranstaltungen. Sobald ein Termin vorbei ist, erscheint er hier – mit Budget, Lessons Learned und Vergleich zum Vorjahr.</p>}

      {yr.length > 0 && (
        <section className="card mb-6 overflow-x-auto"><h2 className="mb-2">Jahre im Vergleich</h2>
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead><tr className="font-display text-sm uppercase tracking-wide text-stone-600"><th className="py-1 pr-3">Jahr</th><th className="px-3">Termine</th><th className="px-3 text-right">Ausgaben</th><th className="px-3 text-right">Einnahmen</th><th className="px-3 text-right">Ergebnis</th><th className="px-3 text-right">Gäste</th><th className="pl-3 text-right">Helfer-Einträge</th></tr></thead>
            <tbody>{yr.map((r) => (
              <tr key={r.y} className={`border-t-2 border-stone-200 ${r.y === sel ? "bg-brand-50 font-semibold" : ""}`}>
                <td className="py-2 pr-3"><Link href={`/archiv?jahr=${r.y}`} className="font-display text-xl font-bold text-brand-600 underline">{r.y}</Link></td><td className="px-3">{r.n}</td>
                <td className="px-3 text-right">{formatMoney(r.exp)}</td><td className="px-3 text-right">{formatMoney(r.inc)}</td><td className={`px-3 text-right font-bold ${r.inc - r.exp < 0 ? "text-poster" : "text-brand-600"}`}>{signed(r.inc - r.exp)}</td>
                <td className="px-3 text-right">{r.guests}</td><td className="pl-3 text-right">{r.helpers}</td></tr>))}</tbody></table>
          <p className="mt-2 text-xs text-stone-500">Beträge: bezahlte bzw. erwartete Werte (ohne abgelehnte Ausgaben).</p></section>
      )}

      {shown.length > 0 && <h2 className="mb-3">{sel}</h2>}
      <div className="space-y-4">
        {shown.map((r) => { const p = prev(r); const lt = r.e.lessonsLearned?.trim();
          return (
            <article key={r.e.id} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-2xl uppercase text-brand-600"><Link href={`/veranstaltungen/${r.e.id}`} className="hover:underline">{r.e.title}</Link></h3>
                <span className="text-sm font-semibold text-stone-600">{formatDay(r.e.date)}{r.e.template ? ` · Vorlage „${r.e.template.name}“` : ""}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
                <div><dt className="text-stone-500">Aufgaben</dt><dd className="font-bold">{r.done}/{r.total} erledigt</dd></div>
                <div><dt className="text-stone-500">Gäste (Zusagen)</dt><dd className="font-bold">{r.guests}{p ? <Delta v={r.guests - p.guests} /> : null}</dd></div>
                <div><dt className="text-stone-500">Ausgaben</dt><dd className="font-bold">{formatMoney(r.b.expectedExpense)}{p ? <Delta v={r.b.expectedExpense - p.b.expectedExpense} money invert /> : null}</dd></div>
                <div><dt className="text-stone-500">Ergebnis</dt><dd className={`font-bold ${r.b.result < 0 ? "text-poster" : "text-brand-600"}`}>{signed(r.b.result)}{p ? <Delta v={r.b.result - p.b.result} money /> : null}</dd></div>
              </dl>
              {p && <p className="mt-1 text-xs text-stone-500">Änderung gegenüber dem Vorgänger „{p.e.title}“ ({p.year}).</p>}
              {lt ? (
                <details className="mt-2"><summary className="font-semibold text-brand-600">Lessons Learned</summary><p className="mt-1 whitespace-pre-line rounded-md bg-sun-light p-3 text-base">{lt}</p></details>
              ) : <p className="mt-2 text-sm text-stone-500">Noch keine Lessons Learned – <Link href={`/veranstaltungen/${r.e.id}`} className="font-semibold text-brand-600 underline">jetzt eintragen</Link>.</p>}
            </article>
          ); })}
      </div>
    </>
  );
}

function Delta({ v, money, invert }: { v: number; money?: boolean; invert?: boolean }) {
  if (v === 0) return <span className="ml-1 text-xs font-semibold text-stone-500">±0</span>;
  const good = invert ? v < 0 : v > 0;
  return <span className={`ml-1 text-xs font-semibold ${good ? "text-brand-600" : "text-poster"}`}>{v > 0 ? "▲" : "▼"} {money ? formatMoney(Math.abs(v)) : Math.abs(v)}</span>;
}
