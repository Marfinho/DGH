import * as webpush from "web-push";
import { db } from "./db";

let ready = false;
function init() {
  if (ready) return true;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@localhost", pub, priv);
  return (ready = true);
}
export const pushEnabled = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Push an Personen (alle, wenn personIds fehlt). Tote Abos werden entfernt. */
export async function sendPush(payload: { title: string; body: string; url?: string }, personIds?: number[]) {
  if (!init()) return 0;
  const subs = await db.pushSubscription.findMany({ where: personIds ? { personId: { in: personIds } } : {} });
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      ok++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    }
  }));
  return ok;
}
