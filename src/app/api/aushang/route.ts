import { db } from "@/lib/db";
import { getUser, hasRole, appUrl } from "@/lib/auth";
import { today, addDays, formatDay } from "@/lib/dates";
import { buildAushang } from "@/lib/aushang";

export async function GET(req: Request) {
  const u = await getUser();
  if (!u || !hasRole(u, "ORGANISATOR")) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const days = Math.min(365, Math.max(7, Number(q.get("tage")) || 60));
  const weeks = Math.min(26, Math.max(0, Number(q.get("muell") ?? 8)));
  const withNews = !q.has("news") || q.getAll("news").includes("1");
  const t = today();

  const events = await db.event.findMany({ where: { published: true, status: "GEPLANT", date: { gte: t, lte: addDays(t, days) } }, orderBy: { date: "asc" }, include: { group: { select: { name: true } } } });
  const wasteRows = weeks ? await db.wasteDate.findMany({ where: { date: { gte: t, lte: addDays(t, weeks * 7) } }, orderBy: { date: "asc" } }) : [];
  const byDay = new Map<string, { date: Date; types: string[] }>();
  for (const w of wasteRows) { const k = w.date.toISOString(); const e = byDay.get(k) ?? { date: w.date, types: [] }; e.types.push(w.type); byDay.set(k, e); }
  const news = withNews ? await db.newsPost.findMany({ where: { publishedAt: { gte: addDays(t, -60) } }, orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }], take: 3 }) : [];

  const pdf = await buildAushang({
    appUrl: appUrl(), stand: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date()),
    events: events.map((e) => ({ date: formatDay(e.date), title: e.title, location: e.location, group: e.group?.name ?? null })),
    waste: [...byDay.values()].map((w) => ({ date: formatDay(w.date), types: w.types })),
    news: news.map((n) => ({ title: n.title, body: n.body })),
  });
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="aushang-${t.toISOString().slice(0, 10)}.pdf"`, "cache-control": "no-store" } });
}
