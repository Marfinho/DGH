import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMoney, toInputMoney } from "./money.ts";
import { summarize, canPay } from "./budget.ts";

test("Beträge parsen", () => {
  assert.equal(parseMoney("12,50"), 1250);
  assert.equal(parseMoney("12.5"), 1250);
  assert.equal(parseMoney("1.234,56 €"), 123456);
  assert.equal(parseMoney("1.234"), 123400);
  assert.equal(parseMoney("1,234"), 123400);
  assert.equal(parseMoney("0,05"), 5);
  assert.equal(parseMoney("80"), 8000);
  for (const bad of ["", "abc", "-5", "1,2,3x", "1,23,4"]) assert.throws(() => parseMoney(bad), bad);
  assert.equal(toInputMoney(123456), "1234,56");
});

test("Budget-Zusammenfassung", () => {
  const items = [
    { kind: "AUSGABE", plannedCents: 50000, actualCents: 48000, status: "BEZAHLT" },
    { kind: "AUSGABE", plannedCents: 30000, actualCents: null, status: "FREIGEGEBEN" },
    { kind: "AUSGABE", plannedCents: 20000, actualCents: null, status: "BEANTRAGT" },
    { kind: "AUSGABE", plannedCents: 99999, actualCents: null, status: "ABGELEHNT" },
    { kind: "EINNAHME", plannedCents: 100000, actualCents: null, status: "ENTWURF" },
    { kind: "EINNAHME", plannedCents: 10000, actualCents: 12000, status: "BEZAHLT" },
  ];
  const s = summarize(items, 90000);
  assert.equal(s.expectedExpense, 48000 + 30000 + 20000);
  assert.equal(s.approved, 48000 + 30000);
  assert.equal(s.pendingApproval, 20000);
  assert.equal(s.paid, 48000);
  assert.equal(s.expectedIncome, 100000 + 12000);
  assert.equal(s.received, 12000);
  assert.equal(s.result, 112000 - 98000);
  assert.equal(s.over, true);
  assert.equal(s.remaining, 90000 - 98000);
  assert.equal(summarize(items, null).remaining, null);
});

test("Bezahlen nur mit Freigabe oder Kleinbetrag", () => {
  assert.equal(canPay({ kind: "AUSGABE", status: "ENTWURF", plannedCents: 2000 }, 0), false);
  assert.equal(canPay({ kind: "AUSGABE", status: "ENTWURF", plannedCents: 2000 }, 5000), true);
  assert.equal(canPay({ kind: "AUSGABE", status: "BEANTRAGT", plannedCents: 2000 }, 5000), false);
  assert.equal(canPay({ kind: "AUSGABE", status: "FREIGEGEBEN", plannedCents: 90000 }, 0), true);
  assert.equal(canPay({ kind: "AUSGABE", status: "ABGELEHNT", plannedCents: 100 }, 5000), false);
  assert.equal(canPay({ kind: "EINNAHME", status: "ENTWURF", plannedCents: 100 }, 0), true);
});
