import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIcs, icsDate } from "./ics-import.ts";

const iso = (xs: { date: Date }[]) => xs.map((x) => x.date.toISOString().slice(0, 10));
const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
const now = new Date("2027-01-01T00:00:00Z");

test("Ganztagstermine und gefaltete Zeilen", () => {
  const r = parseIcs(wrap("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270112\r\nSUMMARY:Restmüll \r\n (graue Tonne)\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270126\r\nSUMMARY:Restmüll (graue Tonne)\r\nEND:VEVENT\r\n"), { now });
  assert.deepEqual(iso(r), ["2027-01-12", "2027-01-26"]);
  assert.equal(r[0].type, "Restmüll (graue Tonne)");
});
test("UTC-Zeitpunkt wird auf deutschen Kalendertag umgerechnet", () => {
  assert.equal(icsDate("20270111T230000Z")!.toISOString().slice(0, 10), "2027-01-12"); // Winter: 23:00 UTC = 00:00 Berlin
  assert.equal(icsDate("20270630T220000Z")!.toISOString().slice(0, 10), "2027-07-01"); // Sommer: 22:00 UTC = 00:00 MESZ
  assert.equal(icsDate("20271301"), null);
});
test("RRULE wöchentlich mit Intervall, COUNT und EXDATE", () => {
  const r = parseIcs(wrap("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270105\r\nRRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4\r\nEXDATE;VALUE=DATE:20270119\r\nSUMMARY:Bio\r\nEND:VEVENT\r\n"), { now });
  assert.deepEqual(iso(r), ["2027-01-05", "2027-02-02", "2027-02-16"]);
});
test("RRULE monatlich bis UNTIL", () => {
  const r = parseIcs(wrap("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270115\r\nRRULE:FREQ=MONTHLY;UNTIL=20270415\r\nSUMMARY:Sperrmüll\r\nEND:VEVENT\r\n"), { now });
  assert.deepEqual(iso(r), ["2027-01-15", "2027-02-15", "2027-03-15", "2027-04-15"]);
});
test("Ohne Enddatum wird auf den Zeithorizont begrenzt", () => {
  const r = parseIcs(wrap("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270105\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Papier\r\nEND:VEVENT\r\n"), { now, horizonDays: 30 });
  assert.ok(r.length >= 4 && r.length <= 6);
});
test("Kaputte Eingabe liefert nichts statt Fehler", () => {
  assert.deepEqual(parseIcs("das ist keine ics datei"), []);
});
