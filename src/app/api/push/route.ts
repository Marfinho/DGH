import { z } from "zod";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

const sub = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

export async function POST(req: Request) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const parsed = sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({ where: { endpoint }, update: { personId: u.id, p256dh: keys.p256dh, auth: keys.auth }, create: { personId: u.id, endpoint, p256dh: keys.p256dh, auth: keys.auth } });
  return Response.json({ ok: true });
}
export async function DELETE(req: Request) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (typeof endpoint === "string") await db.pushSubscription.deleteMany({ where: { endpoint, personId: u.id } });
  return Response.json({ ok: true });
}
