import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given), b = Buffer.from(secret ?? "");
  return !!secret && a.length === b.length && timingSafeEqual(a, b);
}
