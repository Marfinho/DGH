import { db } from "@/lib/db";
import { getUser, hasRole } from "@/lib/auth";
import { readStored } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  const a = await db.attachment.findUnique({ where: { id: Number((await params).id) }, include: { event: true } });
  if (!a) return new Response("Not found", { status: 404 });
  let ok = hasRole(u, "ORGANISATOR");
  if (!ok && a.budgetItemId) ok = !!(await db.eventMember.findFirst({ where: { eventId: a.eventId, personId: u.id, role: "FREIGEBER" } })) || u.role === "ADMIN";
  if (!ok && !a.budgetItemId) ok = a.visible && a.event.published && a.event.status !== "ARCHIVIERT";
  if (!ok) return new Response("Not found", { status: 404 });
  const data = await readStored(a.storedName).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": a.mime, "content-length": String(data.length), "x-content-type-options": "nosniff",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`, "cache-control": "private, max-age=0, must-revalidate",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
