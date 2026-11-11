import { test } from "node:test";
import assert from "node:assert/strict";
import { overlaps, findConflict, validateRange, occupancy } from "./bookings.ts";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const r = (a: string, b: string) => ({ startDate: d(a), endDate: d(b) });

test("Überschneidung inklusive Randtage", () => {
  assert.equal(overlaps(r("2026-12-01", "2026-12-03"), r("2026-12-03", "2026-12-05")), true);
  assert.equal(overlaps(r("2026-12-01", "2026-12-02"), r("2026-12-03", "2026-12-05")), false);
  assert.equal(overlaps(r("2026-12-01", "2026-12-10"), r("2026-12-04", "2026-12-04")), true);
});

test("Konflikt nur mit blockierenden Reservierungen, sich selbst ignorieren", () => {
  const others = [
    { id: 1, status: "STORNIERT", ...r("2026-12-01", "2026-12-05") },
    { id: 2, status: "ABGELEHNT", ...r("2026-12-01", "2026-12-05") },
    { id: 3, status: "ANGEFRAGT", ...r("2026-12-04", "2026-12-04") },
  ];
  assert.equal(findConflict(r("2026-12-01", "2026-12-03"), others), undefined);
  assert.equal(findConflict(r("2026-12-01", "2026-12-04"), others)?.id, 3);
  assert.equal(findConflict(r("2026-12-04", "2026-12-04"), others, 3), undefined);
});

test("Zeitraum wird geprüft", () => {
  const t = d("2026-11-11");
  assert.equal(validateRange(r("2026-11-11", "2026-11-11"), t), 1);
  assert.throws(() => validateRange(r("2026-11-12", "2026-11-11"), t), /Ende/);
  assert.throws(() => validateRange(r("2026-11-10", "2026-11-10"), t), /Vergangenheit/);
  assert.throws(() => validateRange(r("2026-11-12", "2026-12-12"), t), /Höchstens/);
  assert.throws(() => validateRange(r("2029-01-01", "2029-01-01"), t), /Voraus/);
});

test("Belegung pro Tag, bestätigt gewinnt", () => {
  const m = occupancy([
    { status: "ANGEFRAGT", ...r("2026-11-29", "2026-12-02") },
    { status: "BESTAETIGT", ...r("2026-12-02", "2026-12-02") },
    { status: "STORNIERT", ...r("2026-12-05", "2026-12-05") },
  ], d("2026-12-01"), d("2026-12-31"));
  assert.deepEqual([...m.entries()], [["2026-12-01", "ANGEFRAGT"], ["2026-12-02", "BESTAETIGT"]]);
});
