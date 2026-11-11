import { test } from "node:test";
import assert from "node:assert/strict";
import { monthGrid, byDay, parseMonth, parseKinds, toggleKind, shiftMonth, monthKey, CAL_KINDS } from "./calendar.ts";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

test("Monatsraster beginnt montags und deckt den Monat ab", () => {
  const w = monthGrid(d("2026-11-01")); // 1.11.2026 ist ein Sonntag
  assert.equal(iso(w[0][0]), "2026-10-26");
  assert.equal(iso(w[0][6]), "2026-11-01");
  assert.equal(iso(w.at(-1)!.at(-1)!), "2026-12-06");
  assert.equal(w.length, 6);
  assert.equal(monthGrid(d("2027-02-01")).length, 4); // Feb 2027 beginnt Montag, 28 Tage
});

test("Monat parsen und blättern", () => {
  assert.equal(monthKey(parseMonth("2026-12", d("2026-11-11"))), "2026-12");
  assert.equal(monthKey(parseMonth("2026-13", d("2026-11-11"))), "2026-11");
  assert.equal(monthKey(parseMonth(undefined, d("2026-11-11"))), "2026-11");
  assert.equal(monthKey(shiftMonth(d("2026-12-01"), 1)), "2027-01");
  assert.equal(monthKey(shiftMonth(d("2026-01-01"), -1)), "2025-12");
});

test("Einträge je Tag, mehrtägig und auf Bereich begrenzt, nach Art sortiert", () => {
  const m = byDay([
    { kind: "LEIHEN", title: "Haus", start: d("2026-10-30"), end: d("2026-11-02") },
    { kind: "MUELL", title: "Bio", start: d("2026-11-02") },
    { kind: "TERMIN", title: "Fest", start: d("2026-11-02") },
  ], d("2026-11-01"), d("2026-11-30"));
  assert.deepEqual([...m.keys()], ["2026-11-01", "2026-11-02"]);
  assert.deepEqual(m.get("2026-11-02")!.map((e) => e.kind), ["TERMIN", "MUELL", "LEIHEN"]);
});

test("Filter", () => {
  assert.deepEqual(parseKinds(""), CAL_KINDS);
  assert.deepEqual(parseKinds("MUELL,XYZ"), ["MUELL"]);
  assert.deepEqual(toggleKind(["MUELL"], "MUELL"), ["MUELL"]);
  assert.deepEqual(toggleKind(["MUELL"], "TERMIN"), ["TERMIN", "MUELL"]);
  assert.deepEqual(toggleKind(["TERMIN", "MUELL"], "TERMIN"), ["MUELL"]);
});
