import nodemailer from "nodemailer";

export type MailAttachment = { filename: string; content: string; contentType: string };

export const mailConfigured = () => !!process.env.SMTP_URL;

/** Nachricht wie sie verschickt wird (separat, damit sie sich ohne Versand prüfen lässt). */
export const mailOptions = (to: string, subject: string, text: string, attachments?: MailAttachment[]) =>
  ({ from: process.env.SMTP_FROM ?? "Dorfplaner <noreply@localhost>", to, subject, text, ...(attachments?.length ? { attachments } : {}) });

/**
 * Versendet per SMTP_URL (z. B. smtp://user:pass@host:587).
 * Ohne Konfiguration: false. Mit opts.logIfUnconfigured (Standard) landet der Text im Server-Log (für Anmelde-Links);
 * für vertrauliche Inhalte (Protokolle) logIfUnconfigured: false setzen.
 */
export async function sendMail(to: string, subject: string, text: string, opts: { attachments?: MailAttachment[]; logIfUnconfigured?: boolean } = {}) {
  const url = process.env.SMTP_URL;
  if (!url) {
    if (opts.logIfUnconfigured !== false) console.log(`[mail, kein SMTP konfiguriert] an ${to}: ${subject}\n${text}`);
    return false;
  }
  await nodemailer.createTransport(url).sendMail(mailOptions(to, subject, text, opts.attachments));
  return true;
}
