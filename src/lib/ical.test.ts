import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, berlinTime } from "./ical.ts";

test("ICS enthält Ganztagstermin, Escaping und CRLF", () => {
  const s = buildIcs("Test", [{ uid: "e1", title: "Fest, groß; schön", date: new Date("2027-06-19T00:00:00Z"), location: "Dorfplatz" }]);
  assert.match(s, /DTSTART;VALUE=DATE:20270619\r\n/);
  assert.match(s, /DTEND;VALUE=DATE:20270620\r\n/);
  assert.match(s, /SUMMARY:Fest\\, groß\\; schön/);
  assert.ok(s.endsWith("END:VCALENDAR\r\n"));
});
test("Lange Zeilen werden gefaltet", () => {
  const s = buildIcs("T", [{ uid: "x", title: "a".repeat(200), date: new Date("2027-01-01T00:00:00Z") }]);
  assert.ok(s.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
});

test("Semikolon und Komma werden maskiert", () => {
  const s = buildIcs("T", [{ uid: "x", title: "A; B, C", date: new Date("2027-01-01T00:00:00Z") }]);
  assert.ok(s.includes("SUMMARY:A\\; B\\, C\r\n"));
});

test("Termin mit Uhrzeit: 19:30 Berlin im Sommer und Winter", () => {
  assert.equal(berlinTime(new Date("2026-07-20T00:00:00Z"), "19:30").toISOString(), "2026-07-20T17:30:00.000Z");
  assert.equal(berlinTime(new Date("2026-12-14T00:00:00Z"), "19:30").toISOString(), "2026-12-14T18:30:00.000Z");
  assert.equal(berlinTime(new Date("2026-03-29T00:00:00Z"), "12:00").toISOString(), "2026-03-29T10:00:00.000Z"); // Tag der Zeitumstellung
  const s = buildIcs("T", [{ uid: "m", title: "Orga", date: new Date("2026-12-14T00:00:00Z"), startTime: "19:30", endTime: "21:00" }]);
  assert.match(s, /DTSTART:20261214T183000Z\r\n/);
  assert.match(s, /DTEND:20261214T200000Z\r\n/);
  const s2 = buildIcs("T", [{ uid: "m", title: "Orga", date: new Date("2026-07-20T00:00:00Z"), startTime: "19:30" }]);
  assert.match(s2, /DTSTART:20260720T173000Z\r\nDTEND:20260720T193000Z/);
});
