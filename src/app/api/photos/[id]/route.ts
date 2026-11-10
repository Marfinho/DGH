import { db } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { readStored } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const p = await db.photo.findUnique({ where: { id: Number((await params).id) }, include: { post: true, issue: true } });
  if (!p) return new Response("Not found", { status: 404 });
  const orga = hasRole(u, "ORGANISATOR");
  let ok = false;
  if (p.post) ok = orga || p.post.authorId === u.id || p.post.expiresAt > new Date();
  if (p.issue) ok = orga || p.issue.authorId === u.id || p.issue.isPublic;
  if (!ok) return new Response("Not found", { status: 404 });
  const data = await readStored(p.storedName).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "content-type": "image/jpeg", "content-length": String(data.length), "x-content-type-options": "nosniff", "cache-control": "private, max-age=3600", "content-security-policy": "default-src 'none'; sandbox" } });
}
