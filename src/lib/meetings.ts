// Versammlungen des Orga-Teams: reine Logik (Texte, Prüfungen), ohne Datenbank – testbar
export const RESPONSES = ["OFFEN", "ZUGESAGT", "ABGESAGT"] as const;
export type Response = (typeof RESPONSES)[number];
export const RESPONSE_LABEL: Record<Response, string> = { OFFEN: "keine Antwort", ZUGESAGT: "kommt", ABGESAGT: "kommt nicht" };
export const MAIL_STATUS_LABEL: Record<string, string> = { GESENDET: "Mail gesendet", KEINE_ADRESSE: "keine E-Mail-Adresse", FEHLER: "Versand fehlgeschlagen", NICHT_KONFIGURIERT: "Mailversand nicht eingerichtet" };

/** Tagesordnung aus Textfeld: eine Zeile pro Punkt, führende Nummerierung ("1.", "TOP 2:") wird entfernt. */
export function parseAgenda(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.replace(/^\s*(TOP\s*)?\d+[.):]?\s*/i, "").trim().slice(0, 200)).filter(Boolean).slice(0, 40);
}

const dayFmt = (d: Date) => new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
export const whenText = (m: { date: Date; startTime: string; endTime?: string | null }) => `${dayFmt(m.date)}, ${m.startTime}${m.endTime ? `–${m.endTime}` : ""} Uhr`;

type MeetingLike = { title: string; date: Date; startTime: string; endTime?: string | null; location?: string | null; invitationText?: string | null };

export function invitationMail(m: MeetingLike, agenda: string[], name: string, link: string, update = false) {
  const subject = `${update ? "Aktualisierte Einladung" : "Einladung"}: ${m.title} am ${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(m.date)}`;
  const lines = [
    `Hallo ${name.split(" ")[0]},`, "",
    update ? `es gibt Änderungen bei der Einladung zu „${m.title}“.` : `hiermit lade ich dich herzlich zu „${m.title}“ ein.`, "",
    `Wann: ${whenText(m)}`, ...(m.location ? [`Wo:   ${m.location}`] : []), "",
    ...(m.invitationText ? [m.invitationText.trim(), ""] : []),
    ...(agenda.length ? ["Tagesordnung:", ...agenda.map((a, i) => `  ${i + 1}. ${a}`), ""] : []),
    `Bitte gib kurz Bescheid, ob du kommst:`, link, "",
    "Den Termin für deinen Kalender findest du im Anhang.", "", "Viele Grüße", "Dorfgemeinschaft – Orga-Team",
  ];
  return { subject, text: lines.join("\n") };
}

type ProtocolInput = {
  meeting: MeetingLike & { chair?: string | null; minuteTaker?: string | null; guests?: string | null; generalNotes?: string | null; finalizedAt?: Date | null };
  present: string[]; absent: string[];
  agenda: { title: string; notes: string | null; decision: string | null }[];
  todos: { title: string; who: string | null; due: Date | null; agendaIndex: number | null }[];
};

/** Protokoll als reiner Text (für Mail und Archiv). */
export function protocolText(p: ProtocolInput): string {
  const m = p.meeting, d = (x: Date) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(x);
  const out = [`Protokoll: ${m.title}`, `${whenText(m)}${m.location ? ` · ${m.location}` : ""}`, ""];
  if (m.chair) out.push(`Sitzungsleitung: ${m.chair}`);
  if (m.minuteTaker) out.push(`Protokollführung: ${m.minuteTaker}`);
  out.push(`Anwesend (${p.present.length}): ${p.present.join(", ") || "–"}`);
  if (p.absent.length) out.push(`Entschuldigt/abwesend: ${p.absent.join(", ")}`);
  if (m.guests) out.push(`Gäste: ${m.guests}`);
  out.push("");
  p.agenda.forEach((a, i) => {
    out.push(`TOP ${i + 1}: ${a.title}`);
    if (a.notes) out.push(a.notes.trim());
    if (a.decision) out.push(`Beschluss: ${a.decision.trim()}`);
    for (const t of p.todos.filter((x) => x.agendaIndex === i)) out.push(`→ To-do: ${t.title}${t.who ? ` (${t.who}` : " ("}${t.due ? `${t.who ? ", " : ""}bis ${d(t.due)}` : ""})`.replace(" ()", ""));
    out.push("");
  });
  if (m.generalNotes) out.push("Verschiedenes:", m.generalNotes.trim(), "");
  const loose = p.todos.filter((x) => x.agendaIndex === null);
  if (loose.length) { out.push("Weitere To-dos:"); for (const t of loose) out.push(`→ ${t.title}${t.who ? ` – ${t.who}` : ""}${t.due ? ` – bis ${d(t.due)}` : ""}`); out.push(""); }
  out.push(m.finalizedAt ? `Abgeschlossen am ${d(m.finalizedAt)}.` : "Entwurf – noch nicht abgeschlossen.");
  return out.join("\n");
}

/** mailto-Link als Rückfall ohne SMTP (Länge begrenzt, sonst öffnen manche Mailprogramme nichts). */
export function mailtoHref(emails: string[], subject: string, body: string, max = 1800) {
  const b = body.length > max ? body.slice(0, max) + "\n…" : body;
  return `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
}
