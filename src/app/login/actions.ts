"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sha256, newToken, normalizeCode, startSession, endSession, rateLimit, clientIp, appUrl, getUser } from "@/lib/auth";
import { sendMail } from "@/lib/mail";

export type LoginState = { error?: string; info?: string } | null;

export async function requestLink(_: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ip = await clientIp();
  if (!rateLimit(`link:${ip}`, 8) || !rateLimit(`link:${email}`, 4)) return { error: "Zu viele Versuche. Bitte warte einige Minuten." };
  const generic: LoginState = { info: "Falls diese Adresse bei uns hinterlegt ist, haben wir dir einen Anmelde-Link geschickt (15 Minuten gültig)." };
  if (!email) return generic;
  const p = await db.person.findUnique({ where: { email } });
  if (p) {
    const token = newToken();
    await db.loginToken.create({ data: { tokenHash: sha256(token), personId: p.id, expiresAt: new Date(Date.now() + 15 * 60_000) } });
    await sendMail(p.email!, "Dein Anmelde-Link für den Dorfplaner", `Hallo ${p.name},\n\nhier ist dein Link zur Anmeldung (15 Minuten gültig, nur einmal verwendbar):\n\n${appUrl()}/login/token?t=${token}\n\nWenn du das nicht angefordert hast, ignoriere diese Mail einfach.`);
  }
  return generic;
}

export async function redeemInvite(_: LoginState, fd: FormData): Promise<LoginState> {
  const ip = await clientIp();
  if (!rateLimit(`inv:${ip}`, 10)) return { error: "Zu viele Versuche. Bitte warte einige Minuten." };
  const code = normalizeCode(String(fd.get("code") ?? ""));
  const inv = await db.invite.findUnique({ where: { codeHash: sha256(code) } });
  if (!inv || inv.usedAt || inv.expiresAt < new Date()) return { error: "Der Code ist ungültig oder abgelaufen." };
  await db.invite.update({ where: { id: inv.id }, data: { usedAt: new Date() } });
  await startSession(inv.personId);
  redirect("/");
}

export async function redeemToken(fd: FormData) {
  const t = String(fd.get("t") ?? "");
  const tok = await db.loginToken.findUnique({ where: { tokenHash: sha256(t) } });
  if (!tok || tok.usedAt || tok.expiresAt < new Date()) redirect("/login?fehler=link");
  await db.loginToken.update({ where: { id: tok.id }, data: { usedAt: new Date() } });
  await startSession(tok.personId);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function logoutEverywhere() {
  const u = await getUser();
  if (u) await db.session.deleteMany({ where: { personId: u.id } });
  await endSession();
  redirect("/login");
}
