import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpen, validateChoice, tally, parseOptions } from "./polls.ts";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test("Umfrage offen bis einschließlich letztem Tag, manuell beendet = zu", () => {
  assert.equal(isOpen({ closesOn: null, closedAt: null }, d("2026-11-11")), true);
  assert.equal(isOpen({ closesOn: d("2026-11-11"), closedAt: null }, d("2026-11-11")), true);
  assert.equal(isOpen({ closesOn: d("2026-11-10"), closedAt: null }, d("2026-11-11")), false);
  assert.equal(isOpen({ closesOn: null, closedAt: new Date() }, d("2026-11-11")), false);
});

test("Auswahl wird geprüft", () => {
  assert.deepEqual(validateChoice(false, [2], [1, 2, 3]), [2]);
  assert.deepEqual(validateChoice(true, [1, 3, 3], [1, 2, 3]), [1, 3]);
  assert.throws(() => validateChoice(false, [1, 2], [1, 2, 3]), /nur eine/);
  assert.throws(() => validateChoice(true, [9], [1, 2, 3]), /gehört nicht/);
  assert.throws(() => validateChoice(true, [], [1, 2]), /mindestens/);
});

test("Auszählung mit Teilnehmenden und Spitzenreiter", () => {
  const r = tally([1, 2, 3], [{ optionId: 1, personId: 10 }, { optionId: 2, personId: 10 }, { optionId: 2, personId: 11 }, { optionId: 99, personId: 12 }]);
  assert.equal(r.participants, 3);
  assert.deepEqual(r.rows.map((x) => [x.count, x.top]), [[1, false], [2, true], [0, false]]);
  assert.equal(r.rows[1].pct, 67);
  assert.deepEqual(tally([1], []).rows[0], { optionId: 1, count: 0, pct: 0, top: false });
});

test("Antwortzeilen ohne Leerzeilen und Doppelte", () => {
  assert.deepEqual(parseOptions(" Samstag \n\nsonntag\nSamstag\r\nSonntag"), ["Samstag", "sonntag"]);
});
