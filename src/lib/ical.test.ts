import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs } from "./ical.ts";

test("ICS enthält Ganztagstermin, Escaping und CRLF", () => {
  const s = buildIcs("Test", [{ uid: "e1", title: "Fest, groß; schön", date: new Date("2027-06-19T00:00:00Z"), location: "Dorfplatz" }]);
  assert.match(s, /DTSTART;VALUE=DATE:20270619\r\n/);
  assert.match(s, /DTEND;VALUE=DATE:20270620\r\n/);
  assert.match(s, /SUMMARY:Fest\\, groß\; schön/);
  assert.ok(s.endsWith("END:VCALENDAR\r\n"));
});
test("Lange Zeilen werden gefaltet", () => {
  const s = buildIcs("T", [{ uid: "x", title: "a".repeat(200), date: new Date("2027-01-01T00:00:00Z") }]);
  assert.ok(s.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
});
