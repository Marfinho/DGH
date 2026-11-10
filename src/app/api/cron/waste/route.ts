import { db } from "@/lib/db";
import { today, addDays } from "@/lib/dates";
import { sendPush } from "@/lib/push";
import { cronAuthorized } from "@/lib/cron";

// Abends aufrufen (Compose-Dienst "reminders"): erinnert an die Müllabfuhr am nächsten Tag
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const tomorrow = addDays(today(), 1);
  const dates = await db.wasteDate.findMany({ where: { date: tomorrow } });
  if (!dates.length) return Response.json({ ok: true, sent: 0, types: [] });
  const people = await db.person.findMany({ where: { wastePush: true }, select: { id: true, wasteTypes: true } });
  let sent = 0;
  for (const p of people) {
    const wanted = p.wasteTypes ? p.wasteTypes.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const mine = dates.filter((d) => !wanted || wanted.includes(d.type)).map((d) => d.type);
    if (!mine.length) continue;
    sent += await sendPush({ title: "Morgen ist Müllabfuhr", body: `${[...new Set(mine)].join(", ")} – bitte heute Abend rausstellen.`, url: "/muell" }, [p.id]);
  }
  return Response.json({ ok: true, sent, types: [...new Set(dates.map((d) => d.type))] });
}
