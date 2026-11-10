export const BUDGET_KIND = ["AUSGABE", "EINNAHME"] as const;
export type BudgetKind = (typeof BUDGET_KIND)[number];
export const ITEM_STATUS = ["ENTWURF", "BEANTRAGT", "FREIGEGEBEN", "ABGELEHNT", "BEZAHLT"] as const;
export type ItemStatus = (typeof ITEM_STATUS)[number];

export const STATUS_LABEL: Record<BudgetKind, Record<ItemStatus, string>> = {
  AUSGABE: { ENTWURF: "Geplant", BEANTRAGT: "Zur Freigabe", FREIGEGEBEN: "Freigegeben", ABGELEHNT: "Abgelehnt", BEZAHLT: "Bezahlt" },
  EINNAHME: { ENTWURF: "Erwartet", BEANTRAGT: "Erwartet", FREIGEGEBEN: "Erwartet", ABGELEHNT: "Erwartet", BEZAHLT: "Eingegangen" },
};

export type Item = { kind: string; plannedCents: number; actualCents: number | null; status: string };

export function summarize(items: Item[], budgetCents: number | null) {
  const exp = items.filter((i) => i.kind === "AUSGABE"), inc = items.filter((i) => i.kind === "EINNAHME");
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const expectedExpense = sum(exp.filter((i) => i.status !== "ABGELEHNT").map((i) => (i.status === "BEZAHLT" ? i.actualCents ?? i.plannedCents : i.plannedCents)));
  const approved = sum(exp.filter((i) => i.status === "FREIGEGEBEN").map((i) => i.plannedCents)) + sum(exp.filter((i) => i.status === "BEZAHLT").map((i) => i.actualCents ?? i.plannedCents));
  const pendingApproval = sum(exp.filter((i) => i.status === "BEANTRAGT").map((i) => i.plannedCents));
  const paid = sum(exp.filter((i) => i.status === "BEZAHLT").map((i) => i.actualCents ?? i.plannedCents));
  const expectedIncome = sum(inc.map((i) => (i.status === "BEZAHLT" ? i.actualCents ?? i.plannedCents : i.plannedCents)));
  const received = sum(inc.filter((i) => i.status === "BEZAHLT").map((i) => i.actualCents ?? i.plannedCents));
  return {
    expectedExpense, approved, pendingApproval, paid, expectedIncome, received,
    result: expectedIncome - expectedExpense, // Prognose
    cashResult: received - paid, // bisher
    remaining: budgetCents == null ? null : budgetCents - expectedExpense,
    over: budgetCents != null && expectedExpense > budgetCents,
  };
}

/** Darf der Posten als bezahlt eingetragen werden? (Freigabe nötig, außer Kleinbetrag oder Einnahme) */
export function canPay(i: { kind: string; status: string; plannedCents: number }, approvalLimitCents: number) {
  if (i.status === "BEZAHLT") return false;
  if (i.kind === "EINNAHME") return true;
  if (i.status === "FREIGEGEBEN") return true;
  return i.status === "ENTWURF" && i.plannedCents <= approvalLimitCents;
}
