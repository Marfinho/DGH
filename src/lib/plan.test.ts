import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTime, sortSchedule, groupByDay, dayHeading, timeRange, nextMaterialStatus, materialSummary } from "./plan.ts";

test("Uhrzeit wird normalisiert und geprüft", () => {
  assert.equal(parseTime("9:05"), "09:05");
  assert.equal(parseTime("18.30"), "18:30");
  assert.equal(parseTime(""), null);
  assert.throws(() => parseTime("24:00"), /Ungültige/);
  assert.throws(() => parseTime("abends"), /Ungültige/);
});

test("Ablauf sortiert und nach Tag gruppiert", () => {
  const items = [
    { dayOffset: 0, time: "19:00", title: "Anzünden" }, { dayOffset: -1, time: "15:00", title: "Aufbau" },
    { dayOffset: 0, time: null, title: "Ganztägig" }, { dayOffset: 0, time: "17:00", title: "Ausschank" }, { dayOffset: 1, time: "10:00", title: "Abbau" },
  ];
  assert.deepEqual(sortSchedule(items).map((i) => i.title), ["Aufbau", "Ganztägig", "Ausschank", "Anzünden", "Abbau"]);
  assert.deepEqual(groupByDay(items).map((g) => [g.dayOffset, g.items.length]), [[-1, 1], [0, 3], [1, 1]]);
});

test("Tagesüberschrift relativ zum Termin", () => {
  const d = new Date("2026-04-04T00:00:00Z");
  assert.match(dayHeading(d, -1), /03\.04\.2026 · Vortag/);
  assert.match(dayHeading(d, 0), /Veranstaltungstag/);
  assert.match(dayHeading(d, 3), /07\.04\.2026 · 3 Tage danach/);
  assert.equal(timeRange("17:00", "23:00"), "17:00–23:00");
  assert.equal(timeRange(null, null), "");
});

test("Materialstatus weiterschalten und zählen", () => {
  assert.equal(nextMaterialStatus("OFFEN"), "ORGANISIERT");
  assert.equal(nextMaterialStatus("VOR_ORT"), "OFFEN");
  assert.deepEqual(materialSummary([{ status: "OFFEN" }, { status: "VOR_ORT" }, { status: "ORGANISIERT" }]), { OFFEN: 1, ORGANISIERT: 1, VOR_ORT: 1, total: 3, done: 2 });
});
