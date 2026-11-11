import { test } from "node:test";
import assert from "node:assert/strict";
import { STANDARD_TEMPLATES } from "./standard-templates.ts";
import { parseTime } from "./plan.ts";

test("Standardvorlagen sind in sich stimmig", () => {
  assert.deepEqual(STANDARD_TEMPLATES.map((t) => t.name), ["Osterfeuer", "Dorfgemeinschaftsfest", "Weihnachtsmarkt"]);
  for (const t of STANDARD_TEMPLATES) {
    const areas = new Set(t.areas);
    for (const [title, , m, a] of t.tasks) {
      assert.ok(m === null || (m >= 0 && m < t.milestones.length), `${t.name}: Meilenstein bei „${title}“`);
      assert.ok(a === null || areas.has(a), `${t.name}: Gebiet „${a}“ bei „${title}“`);
    }
    for (const [, , , a] of t.budget) assert.ok(a === null || areas.has(a), `${t.name}: Budget-Gebiet ${a}`);
    for (const [, time, end, title] of t.schedule) { assert.equal(parseTime(time), time, title); assert.equal(parseTime(end), end, title); }
    for (const [, , cap] of t.slots) assert.ok(cap >= 1);
    assert.ok(t.schedule.some((s) => s[5]), `${t.name}: mindestens ein öffentlicher Programmpunkt`);
    assert.equal(new Set(t.tasks.map((x) => x[0])).size, t.tasks.length, `${t.name}: doppelte Aufgaben`);
  }
});
