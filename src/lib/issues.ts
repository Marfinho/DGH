export const ISSUE_CATEGORIES = ["STRASSE", "BELEUCHTUNG", "MUELL", "SPIELPLATZ", "GRUENFLAECHE", "SONSTIGES"] as const;
export const ISSUE_CATEGORY_LABEL: Record<string, string> = {
  STRASSE: "Straße / Weg", BELEUCHTUNG: "Beleuchtung", MUELL: "Müll / Verschmutzung", SPIELPLATZ: "Spielplatz / Spielgerät", GRUENFLAECHE: "Grünfläche / Baum", SONSTIGES: "Sonstiges",
};
export const ISSUE_STATUS = ["NEU", "IN_BEARBEITUNG", "WEITERGELEITET", "ERLEDIGT", "ABGELEHNT"] as const;
export const ISSUE_STATUS_LABEL: Record<string, string> = { NEU: "Neu", IN_BEARBEITUNG: "In Bearbeitung", WEITERGELEITET: "An Gemeinde weitergeleitet", ERLEDIGT: "Erledigt", ABGELEHNT: "Abgelehnt" };

export const osmLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

/** Vorbereitete E-Mail an die Gemeinde (öffnet das Mailprogramm der Orga, nichts wird automatisch versendet). */
export function municipalityMailto(to: string, i: { id: number; title: string; description: string; category: string; locationText: string | null; lat: number | null; lng: number | null }, appUrl: string) {
  const lines = [
    "Guten Tag,", "", "aus unserer Dorfgemeinschaft wurde folgendes Anliegen gemeldet:", "",
    `Kategorie: ${ISSUE_CATEGORY_LABEL[i.category] ?? i.category}`, `Betreff: ${i.title}`, "", i.description, "",
    i.locationText ? `Ort: ${i.locationText}` : "", i.lat != null && i.lng != null ? `Karte: ${osmLink(i.lat, i.lng)}` : "", "",
    "Ein Foto liegt uns vor und kann auf Wunsch nachgereicht werden.", "", "Mit freundlichen Grüßen", "Dorfgemeinschaft Haste",
  ].filter((l, idx, arr) => l !== "" || arr[idx - 1] !== "");
  return `mailto:${to}?subject=${encodeURIComponent(`Anliegen #${i.id}: ${i.title}`)}&body=${encodeURIComponent(lines.join("\n"))}`;
}
