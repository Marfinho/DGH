import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const ROLES = ["BEWOHNER", "ORGANISATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { BEWOHNER: "Bewohner", ORGANISATOR: "Organisator", ADMIN: "Admin" };
const RANK: Record<Role, number> = { BEWOHNER: 0, ORGANISATOR: 1, ADMIN: 2 };

const COOKIE = "dp_session";
const SESSION_DAYS = 90;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Einladungscode ohne verwechselbare Zeichen: ABCD-EFGH
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newInviteCode() {
  const b = randomBytes(8);
  const c = Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(.{4})(.{4})/, "$1-$2");

export async function startSession(personId: number) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: sha256(token), personId, expiresAt } });
  await db.person.update({ where: { id: personId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: appUrl().startsWith("https"), path: "/", expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await db.session.deleteMany({ where: { tokenHash: sha256(t) } });
  jar.delete(COOKIE);
}

export async function getUser() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(t) }, include: { person: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.person;
}
export type User = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export const hasRole = (u: { role: string }, min: Role) => RANK[u.role as Role] >= RANK[min];

/** Seiten und Server Actions rufen das auf; leitet auf /login bzw. Übersicht um. */
export async function requireUser(min: Role = "BEWOHNER"): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  if (!hasRole(u, min)) redirect("/?fehler=berechtigung");
  return u;
}

// Einfaches In-Memory-Rate-Limit (reicht für eine einzelne Instanz)
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs = 15 * 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length <= max;
}
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
