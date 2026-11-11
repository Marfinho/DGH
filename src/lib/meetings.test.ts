import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAgenda, invitationMail, protocolText, mailtoHref } from "./meetings.ts";

const m = { title: "Orga-Treffen", date: new Date("2026-12-14T00:00:00Z"), startTime: "19:30", endTime: "21:00", location: "Gemeindehaus", invitationText: "Bitte Kalender mitbringen." };

test("Tagesordnung: Nummern entfernt, Leerzeilen raus", () => {
  assert.deepEqual(parseAgenda("1. Begrüßung\n\nTOP 2: Osterfeuer\n3) Verschiedenes\n  Kasse "), ["Begrüßung", "Osterfeuer", "Verschiedenes", "Kasse"]);
});

test("Einladung mit Termin, Ort, Tagesordnung und Link", () => {
  const r = invitationMail(m, ["Begrüßung", "Osterfeuer"], "Olga Orga", "https://x/versammlungen/1");
  assert.equal(r.subject, "Einladung: Orga-Treffen am 14.12.2026");
  assert.match(r.text, /^Hallo Olga,/);
  assert.match(r.text, /Wann: Montag, 14\. Dezember 2026, 19:30–21:00 Uhr/);
  assert.match(r.text, /Wo:   Gemeindehaus/);
  assert.match(r.text, /  2\. Osterfeuer/);
  assert.match(r.text, /https:\/\/x\/versammlungen\/1/);
  assert.match(invitationMail(m, [], "A", "l", true).subject, /^Aktualisierte Einladung/);
});

test("Protokoll-Text", () => {
  const s = protocolText({
    meeting: { ...m, chair: "Anna", minuteTaker: "Olga", generalNotes: "Nächstes Treffen im Januar", finalizedAt: new Date("2026-12-15T10:00:00Z") },
    present: ["Anna", "Olga"], absent: ["Ben"],
    agenda: [{ title: "Osterfeuer", notes: "Holzannahme klären", decision: "Termin 27.3. (einstimmig)" }, { title: "Kasse", notes: null, decision: null }],
    todos: [{ title: "Feuerwehr anfragen", who: "Ben", due: new Date("2027-01-10T00:00:00Z"), agendaIndex: 0 }, { title: "Raum buchen", who: null, due: null, agendaIndex: null }],
  });
  assert.match(s, /Anwesend \(2\): Anna, Olga/);
  assert.match(s, /Entschuldigt\/abwesend: Ben/);
  assert.match(s, /TOP 1: Osterfeuer\nHolzannahme klären\nBeschluss: Termin 27\.3\. \(einstimmig\)\n→ To-do: Feuerwehr anfragen \(Ben, bis 10\.01\.2027\)/);
  assert.match(s, /Weitere To-dos:\n→ Raum buchen/);
  assert.match(s, /Abgeschlossen am 15\.12\.2026\./);
});

test("mailto-Rückfall wird begrenzt", () => {
  const h = mailtoHref(["a@x.de", "b@x.de"], "Betreff ä", "x".repeat(5000), 100);
  assert.ok(h.startsWith("mailto:?bcc=a%40x.de%2Cb%40x.de&subject=Betreff%20%C3%A4&body="));
  assert.ok(h.length < 500);
});
