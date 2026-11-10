import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type AushangData = {
  appUrl: string;
  stand: string; // formatiert
  events: { date: string; title: string; location: string | null; group: string | null }[];
  waste: { date: string; types: string[] }[];
  news: { title: string; body: string }[];
};

// Standard-PDF-Schriften kennen nur Latin-1/WinAnsi: Emojis & Co. entfernen, damit nichts kaputt dargestellt wird
const clean = (s: string) => s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/[^\x09\x0A\x20-\x7E -ÿ–—‘’“”•€…]/g, "?").trim();
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + " …" : s);

const GREEN = "#0B4F2A", RED = "#BA1722", INK = "#14281B", GRAY = "#4B5E54";

/** Druckfertiger Aushang (A4) für Schaukasten/Dorfladen: große Schrift, Termine, Müllabfuhr, Neuigkeiten, QR-Code zur App. */
export async function buildAushang(d: AushangData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 42, left: 42, right: 42, bottom: 128 }, bufferPages: true, info: { Title: "Aushang Dorfgemeinschaft Haste", Author: "Dorfplaner" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 84;

  const logo = await readFile(path.join(process.cwd(), "public", "logo.png")).catch(() => null);
  if (logo) doc.image(logo, 42, 36, { width: 210 });
  doc.fillColor(GRAY).font("Helvetica").fontSize(11).text(`Stand: ${d.stand}`, 42, 44, { width: W, align: "right" });
  doc.moveTo(42, 106).lineTo(42 + W, 106).lineWidth(4).strokeColor(GREEN).stroke();
  doc.y = 122;

  const heading = (t: string, color = GREEN) => {
    if (doc.y > doc.page.height - 230) doc.addPage();
    doc.moveDown(0.6).fillColor(color).font("Helvetica-Bold").fontSize(22).text(clean(t).toUpperCase(), 42, doc.y, { width: W });
    doc.moveDown(0.3);
  };

  doc.fillColor(RED).font("Helvetica-Bold").fontSize(30).text("Das ist los bei uns", 42, doc.y, { width: W });

  heading("Termine");
  if (!d.events.length) doc.fillColor(INK).font("Helvetica").fontSize(15).text("Zurzeit sind keine Termine eingetragen.");
  for (const e of d.events) {
    if (doc.y > doc.page.height - 200) doc.addPage();
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(16).text(clean(e.date), 42, doc.y, { width: W });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(17).text(clean(e.title), { width: W });
    const sub = [e.location, e.group ? `Veranstalter: ${e.group}` : null].filter(Boolean).join("  ·  ");
    if (sub) doc.fillColor(GRAY).font("Helvetica").fontSize(13).text(clean(sub), { width: W });
    doc.moveDown(0.6);
  }

  if (d.waste.length) {
    heading("Müllabfuhr");
    for (const w of d.waste) {
      if (doc.y > doc.page.height - 200) doc.addPage();
      const y = doc.y;
      doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(15).text(clean(w.date), 42, y, { width: 150 });
      doc.fillColor(INK).font("Helvetica").fontSize(15).text(clean(w.types.join(", ")), 200, y, { width: W - 160 });
      doc.moveDown(0.25);
    }
  }

  if (d.news.length) {
    heading("Neuigkeiten");
    for (const n of d.news) {
      if (doc.y > doc.page.height - 220) doc.addPage();
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text(clean(n.title), 42, doc.y, { width: W });
      doc.fillColor(INK).font("Helvetica").fontSize(13).text(clean(short(n.body, 320)), { width: W });
      doc.moveDown(0.6);
    }
  }

  // Fußzeile mit QR-Code auf jeder Seite
  const qr = await QRCode.toBuffer(`${d.appUrl}/installieren`, { margin: 1, width: 300, color: { dark: GREEN, light: "#FFFFFF" } });
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // Fußzeile darf in den unteren Rand schreiben, ohne eine neue Seite zu erzeugen
    const y = doc.page.height - 118;
    doc.moveTo(42, y - 8).lineTo(42 + W, y - 8).lineWidth(2).strokeColor(GREEN).stroke();
    doc.image(qr, 42, y, { width: 90 });
    doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(15).text("Alles aktuell aufs Handy:", 148, y + 8, { width: W - 120, lineBreak: false });
    doc.fillColor(INK).font("Helvetica").fontSize(13).text("QR-Code scannen oder Adresse eingeben:", 148, y + 28, { width: W - 120, lineBreak: false });
    doc.fillColor(RED).font("Helvetica-Bold").fontSize(14).text(clean(d.appUrl.replace(/^https?:\/\//, "") + "/installieren"), 148, y + 48, { width: W - 120, lineBreak: false });
    doc.fillColor(GRAY).font("Helvetica").fontSize(10).text(`Seite ${i + 1} von ${pages.count}`, 42, doc.page.height - 22, { width: W, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
