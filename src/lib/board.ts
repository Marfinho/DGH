export const BOARD_CATEGORIES = ["ALLGEMEIN", "MITFAHREN", "LEIHEN", "HILFE", "FUNDBUERO"] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<BoardCategory, string> = {
  ALLGEMEIN: "Suche & Biete", MITFAHREN: "Mitfahren", LEIHEN: "Leihen & Verschenken", HILFE: "Nachbarschaftshilfe", FUNDBUERO: "Fundbüro",
};
export const KINDS = ["BIETE", "SUCHE"] as const;
export type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<BoardCategory, Record<Kind, string>> = {
  ALLGEMEIN: { BIETE: "Ich biete", SUCHE: "Ich suche" },
  LEIHEN: { BIETE: "Ich verleihe / verschenke", SUCHE: "Ich suche zum Leihen" },
  MITFAHREN: { BIETE: "Ich biete eine Fahrt an", SUCHE: "Ich suche eine Mitfahrgelegenheit" },
  HILFE: { BIETE: "Ich helfe gern", SUCHE: "Ich brauche Hilfe" },
  FUNDBUERO: { BIETE: "Gefunden", SUCHE: "Verloren" },
};
export const kindLabel = (c: string, k: string) => KIND_LABEL[c as BoardCategory]?.[k as Kind] ?? k;
export const defaultDays = (c: string) => (c === "FUNDBUERO" ? 60 : 30);

/** Telefonnummern und E-Mail-Adressen im Kontakttext anklickbar machen. */
export function contactHref(text: string): string | null {
  const mail = text.match(/[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i);
  if (mail) return `mailto:${mail[0]}`;
  const tel = text.match(/\+?[\d][\d\s/()-]{5,}\d/);
  return tel ? `tel:${tel[0].replace(/[^\d+]/g, "")}` : null;
}
