/** Beträge werden als ganze Cent gespeichert. */
export function parseMoney(input: string): number {
  let s = input.replace(/[€\s]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) throw new Error("Ungültiger Betrag");
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  const dec = Math.max(lastComma, lastDot);
  let intPart = s, frac = "";
  // letztes Trennzeichen ist Dezimaltrenner, wenn danach 1–2 Ziffern folgen
  if (dec >= 0 && s.length - dec - 1 <= 2) { intPart = s.slice(0, dec); frac = s.slice(dec + 1); }
  if (!/^(\d+|\d{1,3}([.,]\d{3})+)$/.test(intPart)) throw new Error("Ungültiger Betrag");
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart) || (frac && !/^\d{1,2}$/.test(frac))) throw new Error("Ungültiger Betrag");
  const cents = Number(intPart) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_00) throw new Error("Betrag zu groß");
  return cents;
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const formatMoney = (cents: number) => eur.format(cents / 100);
export const toInputMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
