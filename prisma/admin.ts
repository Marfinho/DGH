// Ersten Admin anlegen bzw. Einladungscode erneuern:
//   npm run admin -- "Vorname Nachname" mail@example.de
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const db = new PrismaClient();
const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

async function main() {
  const [name, emailRaw] = process.argv.slice(2);
  if (!name) { console.error('Aufruf: npm run admin -- "Name" [email]'); process.exit(1); }
  const email = emailRaw?.toLowerCase() || null;
  const existing = email ? await db.person.findUnique({ where: { email } }) : await db.person.findFirst({ where: { name } });
  const p = existing
    ? await db.person.update({ where: { id: existing.id }, data: { role: "ADMIN" } })
    : await db.person.create({ data: { name, email, role: "ADMIN" } });
  const c = Array.from(randomBytes(8), (x) => A[x % A.length]).join("");
  const code = `${c.slice(0, 4)}-${c.slice(4)}`;
  await db.invite.create({ data: { personId: p.id, codeHash: createHash("sha256").update(code).digest("hex"), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
  console.log(`Admin „${p.name}“ bereit. Einladungscode (7 Tage gültig): ${code}`);
}
main().finally(() => db.$disconnect());
