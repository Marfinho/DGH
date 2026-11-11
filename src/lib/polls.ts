// Reine Logik für Umfragen (ohne Datenbank, testbar)

export type PollState = { closesOn: Date | null; closedAt: Date | null };

/** Abstimmen ist möglich, solange die Umfrage nicht beendet ist und der letzte Tag nicht vorbei ist. */
export const isOpen = (p: PollState, today: Date) => !p.closedAt && (!p.closesOn || today.getTime() <= p.closesOn.getTime());

/**
 * Prüft eine Auswahl: nur Antworten dieser Umfrage, keine Doppelten, bei Einzelauswahl genau eine.
 * Liefert die bereinigten Ids oder wirft einen Fehler mit deutscher Meldung.
 */
export function validateChoice(multiple: boolean, chosen: number[], validIds: number[]): number[] {
  const valid = new Set(validIds);
  const ids = [...new Set(chosen.filter((n) => Number.isInteger(n)))];
  if (!ids.length) throw new Error("Bitte mindestens eine Antwort wählen.");
  if (ids.some((id) => !valid.has(id))) throw new Error("Diese Antwort gehört nicht zur Umfrage.");
  if (!multiple && ids.length > 1) throw new Error("Hier ist nur eine Antwort möglich.");
  return ids;
}

export type Tally = { optionId: number; count: number; pct: number; top: boolean };

/** Stimmen je Antwort, Anteil an den Teilnehmenden (bei Mehrfachauswahl kann die Summe > 100 % sein). */
export function tally(optionIds: number[], votes: { optionId: number; personId: number }[]): { rows: Tally[]; participants: number } {
  const participants = new Set(votes.map((v) => v.personId)).size;
  const counts = new Map(optionIds.map((id) => [id, 0]));
  for (const v of votes) if (counts.has(v.optionId)) counts.set(v.optionId, counts.get(v.optionId)! + 1);
  const max = Math.max(0, ...counts.values());
  return {
    participants,
    rows: optionIds.map((id) => {
      const count = counts.get(id)!;
      return { optionId: id, count, pct: participants ? Math.round((count / participants) * 100) : 0, top: max > 0 && count === max };
    }),
  };
}

/** Antwortzeilen aus dem Formular: eine pro Zeile, getrimmt, ohne Doppelte. */
export function parseOptions(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().slice(0, 200);
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out;
}
