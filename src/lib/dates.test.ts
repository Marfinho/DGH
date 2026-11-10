import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDay, addDays, diffDays, toInput } from "./dates.ts";

test("Offset vor dem Event", () => {
  assert.equal(toInput(addDays(parseDay("2027-06-19"), -60)), "2027-04-20");
});
test("Über Sommerzeit-Grenze", () => {
  assert.equal(toInput(addDays(parseDay("2027-03-30"), -3)), "2027-03-27");
  assert.equal(diffDays(parseDay("2027-04-02"), parseDay("2027-03-25")), 8);
});
test("Hin und zurück", () => {
  const ev = parseDay("2027-10-31"), due = parseDay("2027-09-01");
  assert.equal(toInput(addDays(ev, diffDays(due, ev))), "2027-09-01");
});
test("Ungültiges Datum", () => {
  assert.throws(() => parseDay("2027-02-30"));
});
