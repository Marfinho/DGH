import nodemailer from "nodemailer";

/** Versendet per SMTP_URL (z. B. smtp://user:pass@host:587). Ohne Konfiguration wird der Text ins Server-Log geschrieben. */
export async function sendMail(to: string, subject: string, text: string) {
  const url = process.env.SMTP_URL;
  if (!url) {
    console.log(`[mail, kein SMTP konfiguriert] an ${to}: ${subject}\n${text}`);
    return false;
  }
  await nodemailer.createTransport(url).sendMail({ from: process.env.SMTP_FROM ?? "Dorfplaner <noreply@localhost>", to, subject, text });
  return true;
}
