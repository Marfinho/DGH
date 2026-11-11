// Fertige Vorlagen für typische Veranstaltungen der Dorfgemeinschaft.
// Bewusst als Startpunkt formuliert: Genehmigungen und Fristen unterscheiden sich je nach Land und Gemeinde –
// die Orga passt die Vorlage an und speichert sie nach dem ersten Durchlauf mit „Als Vorlage speichern“.
import type { PrismaClient } from "@prisma/client";

type Ms = [title: string, offsetDays: number];
type Tk = [title: string, offsetDays: number, milestone: number | null, area: string | null, note?: string];
type Sl = [title: string, timeText: string | null, capacity: number, description?: string];
type Sc = [dayOffset: number, time: string | null, endTime: string | null, title: string, place: string | null, isPublic: boolean, note?: string];
type Mt = [title: string, quantity: string | null, source: string | null, note?: string];
type Bg = [kind: "AUSGABE" | "EINNAHME", title: string, euros: number, area: string | null];

export type StandardTemplate = { name: string; description: string; areas: string[]; milestones: Ms[]; tasks: Tk[]; slots: Sl[]; schedule: Sc[]; material: Mt[]; budget: Bg[] };

const ORGA = "Organisation & Genehmigungen", SICHER = "Sicherheit", VERPF = "Verpflegung & Ausschank", WERB = "Marketing & Presse", TECH = "Technik & Aufbau", PROG = "Programm";

export const STANDARD_TEMPLATES: StandardTemplate[] = [
  {
    name: "Osterfeuer",
    description: "Osterfeuer mit Holzannahme, Ausschank und Grill – Startpunkt, bitte an die Regeln der Gemeinde anpassen.",
    areas: [ORGA, "Feuer & Holz", SICHER, VERPF, WERB, TECH],
    milestones: [["Planung & Genehmigungen stehen", -45], ["Vorbereitung abgeschlossen", -3], ["Osterfeuer", 0], ["Nachbereitung", 7]],
    tasks: [
      ["Termin und Platz mit Eigentümer/Gemeinde abstimmen", -90, 0, ORGA],
      ["Osterfeuer bei Gemeinde/Ordnungsamt anmelden bzw. Genehmigung einholen", -60, 0, ORGA, "Auflagen notieren: Abstände, erlaubtes Brennmaterial, Uhrzeit, ggf. Brandschutzauflagen"],
      ["Freiwillige Feuerwehr um Brandwache bitten", -60, 0, SICHER],
      ["Veranstalterhaftpflicht prüfen / Versicherung informieren", -45, 0, ORGA],
      ["Ausschank beim Ordnungsamt anmelden (vorübergehende Gestattung)", -30, 1, ORGA, "nur nötig, wenn Getränke verkauft werden – Regeln bei der Gemeinde erfragen"],
      ["Termine für Holzannahme festlegen und bekanntgeben", -28, 1, "Feuer & Holz", "nur unbehandeltes Holz und Baum-/Strauchschnitt, keine Bretter mit Lack, Nägeln oder Folie"],
      ["Plakate, Presse und Dorfplaner-Neuigkeit", -21, 1, WERB],
      ["Getränke bestellen (Kommission und Rückgabe klären)", -21, 1, VERPF],
      ["Grillgut, Brötchen und Senf/Ketchup bestellen", -10, 1, VERPF],
      ["Helfer für Theke, Grill und Kasse einteilen", -14, 1, VERPF],
      ["Holzannahme betreuen", -7, 1, "Feuer & Holz"],
      ["Wetter und Waldbrandgefahr prüfen, ggf. absagen", -1, 2, SICHER],
      ["Haufen vor dem Anzünden umschichten (Tiere wie Igel schützen)", 0, 2, "Feuer & Holz"],
      ["Glutreste kontrollieren und Platz aufräumen", 1, 3, "Feuer & Holz"],
      ["Leergut zurückgeben, Kasse abrechnen", 3, 3, VERPF],
      ["Danke an Helfer und Feuerwehr", 7, 3, ORGA],
    ],
    slots: [
      ["Holzannahme", "Samstag vor dem Feuer, 10–14 Uhr", 3, "Holz prüfen, nur unbehandeltes Holz annehmen"],
      ["Aufbau Theke, Grill und Beleuchtung", "Vortag, ab 15 Uhr", 4],
      ["Theke", "17–20 Uhr", 3], ["Theke", "20–23 Uhr", 3],
      ["Grill", "17–21 Uhr", 2], ["Kasse / Bons", "17–21 Uhr", 1],
      ["Abbau und Aufräumen", "Tag danach, 10 Uhr", 4],
    ],
    schedule: [
      [-1, "15:00", "18:00", "Aufbau Theke, Grill, Strom und Beleuchtung", "Festplatz", false],
      [0, "15:00", null, "Haufen umschichten, Absperrung aufstellen", "Feuerstelle", false],
      [0, "16:30", null, "Grill anheizen, Kasse übernehmen", null, false],
      [0, "17:00", null, "Ausschank und Grill geöffnet", "Festplatz", true],
      [0, "19:00", null, "Anzünden des Osterfeuers", "Feuerstelle", true, "nur mit Brandwache vor Ort"],
      [0, "23:00", null, "Ende Ausschank", null, false],
      [1, "10:00", "13:00", "Abbau, Glutkontrolle, Müll", "Festplatz", false],
    ],
    material: [
      ["Bierzeltgarnituren", "10 Sets", "Inventar (Reservierung im Dorfplaner)"], ["Grill und Gasflaschen", "1 Grill, 2 Flaschen", "eigenes Inventar"],
      ["Theke / Ausschankwagen", "1", "leihen"], ["Kühlung (Kühlwagen oder Kühlschränke)", null, "leihen beim Getränkehändler"],
      ["Stromverteiler und Kabeltrommeln", null, "eigenes Inventar"], ["Beleuchtung / Lichterketten", null, "eigenes Inventar"],
      ["Feuerlöscher", "2", "eigenes Inventar", "Prüfdatum kontrollieren"], ["Absperrband und Pfosten", null, "Feuerwehr fragen"],
      ["Kasse und Wechselgeld", "1", "Kassenwart"], ["Becher (Pfand) und Servietten", null, "kaufen"], ["Müllsäcke", "1 Rolle", "kaufen"],
    ],
    budget: [
      ["AUSGABE", "Getränke", 600, VERPF], ["AUSGABE", "Grillgut und Brötchen", 300, VERPF], ["AUSGABE", "Verbrauchsmaterial (Becher, Servietten, Müllsäcke)", 60, TECH],
      ["AUSGABE", "Plakate", 30, WERB], ["EINNAHME", "Getränkeverkauf", 1200, VERPF], ["EINNAHME", "Essensverkauf", 600, VERPF],
    ],
  },
  {
    name: "Dorfgemeinschaftsfest",
    description: "Großes Sommerfest mit Zelt, Musik, Kinderprogramm, Kuchenbuffet und Ausschank – Startpunkt zum Anpassen.",
    areas: [ORGA, PROG, VERPF, WERB, TECH, SICHER],
    milestones: [["Rahmen steht (Termin, Budget, Platz)", -90], ["Genehmigungen, Programm und Helfer stehen", -30], ["Bestellungen und Werbung erledigt", -10], ["Aufbau", -1], ["Fest", 0], ["Nachbereitung", 14]],
    tasks: [
      ["Termin festlegen (Ferien, Nachbarorte, Vereinstermine prüfen)", -150, 0, ORGA],
      ["Budget aufstellen", -120, 0, ORGA],
      ["Festplatz/Halle reservieren", -120, 0, ORGA],
      ["Zelt anfragen oder mieten", -120, 0, TECH],
      ["Fest bei Gemeinde/Ordnungsamt anmelden (Sondernutzung, ggf. Straßensperrung, Lärm)", -90, 0, ORGA],
      ["Ausschank anmelden (vorübergehende Gestattung)", -60, 1, ORGA],
      ["Veranstalterhaftpflicht prüfen", -60, 1, ORGA],
      ["Musik/DJ buchen", -90, 1, PROG],
      ["Musik bei der GEMA anmelden (bzw. klären, ob nötig)", -30, 1, ORGA],
      ["Kinderprogramm planen (Hüpfburg, Spiele, Schminken)", -60, 1, PROG],
      ["Tombola: Preise bei Firmen im Ort anfragen", -60, 1, PROG],
      ["Erste Hilfe / Sanitätsdienst anfragen", -60, 1, SICHER],
      ["Toilettenwagen bestellen", -45, 1, TECH],
      ["Strom (Anschluss, Verteiler) klären", -45, 1, TECH],
      ["Getränke und Kühlung bestellen", -30, 1, VERPF],
      ["Essen planen und bestellen (Grill, Pommes, vegetarisch)", -21, 2, VERPF],
      ["Kuchenspenden sammeln (Liste im Brett/Umfrage)", -21, 2, VERPF],
      ["Belehrung Lebensmittelhygiene für Helfer am Essen klären", -21, 2, VERPF],
      ["Plakate, Presse, Flyer, Dorfplaner-Neuigkeit", -28, 2, WERB],
      ["Helfer-Aufruf und Schichtplan", -28, 2, ORGA],
      ["Nachbarn in der Nähe des Festplatzes informieren", -10, 2, WERB],
      ["Wechselgeld bei der Bank holen", -3, 3, ORGA],
      ["Aufbau Zelt, Bänke, Theke, Strom", -1, 3, TECH],
      ["Abbau, Müll, Platz besenrein übergeben", 1, 5, TECH],
      ["Leergut, Mietgeräte und Kühlung zurückgeben", 2, 5, VERPF],
      ["Kasse abrechnen, Belege ins Budget", 7, 5, ORGA],
      ["Helferfest / Danke und Lessons Learned", 14, 5, ORGA],
    ],
    slots: [
      ["Aufbau Zelt und Bänke", "Vortag, ab 14 Uhr", 8], ["Theke", "14–17 Uhr", 3], ["Theke", "17–20 Uhr", 3], ["Theke", "20–23 Uhr", 3],
      ["Grill", "14–18 Uhr", 2], ["Grill", "18–21 Uhr", 2], ["Kuchenbuffet / Kaffee", "14–17 Uhr", 3], ["Kinderprogramm", "14–17 Uhr", 3],
      ["Kasse / Bons", "14–18 Uhr", 1], ["Kasse / Bons", "18–22 Uhr", 1], ["Abbau", "Tag danach, 10 Uhr", 8],
    ],
    schedule: [
      [-1, "14:00", "19:00", "Aufbau Zelt, Bänke, Theke, Strom", "Festplatz", false],
      [0, "10:00", "13:00", "Restaufbau, Kühlung befüllen, Wechselgeld verteilen", "Festplatz", false],
      [0, "14:00", null, "Eröffnung und Begrüßung", "Festzelt", true],
      [0, "14:00", "17:00", "Kaffee und Kuchen", "Festzelt", true],
      [0, "14:30", "17:30", "Kinderprogramm und Hüpfburg", "Wiese", true],
      [0, "17:00", null, "Ziehung der Tombola", "Festzelt", true],
      [0, "19:00", null, "Musik / Tanz", "Festzelt", true],
      [0, "23:00", null, "Ende Ausschank", null, false],
      [1, "10:00", "14:00", "Abbau und Aufräumen", "Festplatz", false],
    ],
    material: [
      ["Festzelt", "1", "mieten / Verein fragen"], ["Bierzeltgarnituren", "30 Sets", "Inventar + leihen"], ["Theke / Ausschankwagen", "1", "leihen"],
      ["Kühlwagen", "1", "Getränkehändler"], ["Grill, Gas, Fritteuse", null, "Inventar"], ["Kaffeemaschinen und Kuchenteller", null, "Inventar"],
      ["Hüpfburg", "1", "mieten"], ["Musikanlage / Mikrofon", "1", "Band/DJ oder leihen"], ["Stromverteiler und Kabeltrommeln", null, "Inventar"],
      ["Toilettenwagen", "1", "mieten"], ["Erste-Hilfe-Koffer", "1", "Inventar"], ["Kasse, Bons und Wechselgeld", null, "Kassenwart"],
      ["Tombola-Lose und Preise", null, "Spenden"], ["Müllsäcke, Mülltonnen", null, "kaufen / Gemeinde"], ["Absperrung und Schilder", null, "Gemeinde/Feuerwehr"],
    ],
    budget: [
      ["AUSGABE", "Zeltmiete", 800, TECH], ["AUSGABE", "Musik/DJ", 600, PROG], ["AUSGABE", "GEMA", 100, ORGA], ["AUSGABE", "Hüpfburg", 150, PROG],
      ["AUSGABE", "Toilettenwagen", 250, TECH], ["AUSGABE", "Getränke", 1500, VERPF], ["AUSGABE", "Essen", 800, VERPF], ["AUSGABE", "Werbung", 80, WERB],
      ["EINNAHME", "Getränkeverkauf", 3000, VERPF], ["EINNAHME", "Essensverkauf", 1400, VERPF], ["EINNAHME", "Kuchenverkauf", 300, VERPF], ["EINNAHME", "Tombola", 400, PROG],
    ],
  },
  {
    name: "Weihnachtsmarkt",
    description: "Weihnachtsmarkt mit Buden der Vereine, Glühwein, Musik und Besuch vom Nikolaus – Startpunkt zum Anpassen.",
    areas: [ORGA, "Stände & Buden", PROG, VERPF, WERB, TECH, SICHER],
    milestones: [["Rahmen und Genehmigungen stehen", -60], ["Standbetreiber und Programm stehen", -21], ["Aufbau", -1], ["Markttag", 0], ["Nachbereitung", 10]],
    tasks: [
      ["Termin festlegen (Adventswochenende, Nachbarmärkte prüfen)", -150, 0, ORGA],
      ["Platz reservieren, Budget aufstellen", -120, 0, ORGA],
      ["Markt bei Gemeinde/Ordnungsamt anmelden (Sondernutzung, ggf. Sperrung)", -75, 0, ORGA],
      ["Ausschank anmelden (vorübergehende Gestattung)", -60, 0, ORGA],
      ["Veranstalterhaftpflicht prüfen", -60, 0, ORGA],
      ["Vereine, Kita, Schule und Hobby-Aussteller als Standbetreiber einladen", -90, 0, "Stände & Buden"],
      ["Standplan zeichnen (Strombedarf je Stand abfragen)", -30, 1, "Stände & Buden"],
      ["Buden/Pavillons organisieren", -45, 1, "Stände & Buden"],
      ["Posaunenchor / Kinderchor / Kita-Auftritt anfragen", -60, 1, PROG],
      ["Nikolaus und Geschenktüten organisieren", -45, 1, PROG],
      ["Musik bei der GEMA anmelden (bzw. klären, ob nötig)", -21, 1, ORGA],
      ["Glühwein, Kinderpunsch und Tassen bestellen", -21, 1, VERPF],
      ["Belehrung Lebensmittelhygiene für Helfer am Essen klären", -21, 1, VERPF],
      ["Beleuchtung und Strom planen (Verteiler, Kabelbrücken)", -30, 1, TECH],
      ["Feuerschalen/Heizstrahler: Brandschutz klären", -21, 1, SICHER],
      ["Plakate, Presse, Dorfplaner-Neuigkeit", -28, 1, WERB],
      ["Winterdienst: Streugut und Räumen bei Glätte klären", -7, 2, SICHER],
      ["Wechselgeld holen, Tassenpfand vorbereiten", -3, 2, ORGA],
      ["Aufbau Buden, Beleuchtung, Strom", -1, 2, TECH],
      ["Abbau und Platz räumen", 1, 4, TECH],
      ["Tassen zählen/spülen, Leergut zurück", 2, 4, VERPF],
      ["Abrechnung (Standgebühren, Kasse), Belege ins Budget", 7, 4, ORGA],
      ["Danke an Standbetreiber und Helfer, Lessons Learned", 10, 4, ORGA],
    ],
    slots: [
      ["Aufbau Buden und Beleuchtung", "Vortag, ab 13 Uhr", 8], ["Glühweinstand", "15–18 Uhr", 3], ["Glühweinstand", "18–21 Uhr", 3],
      ["Kinderpunsch und Waffeln", "15–18 Uhr", 2], ["Kasse / Tassenpfand", "15–18 Uhr", 1], ["Kasse / Tassenpfand", "18–21 Uhr", 1],
      ["Kinderbasteln", "15–17 Uhr", 2], ["Abbau", "Tag danach, 10 Uhr", 8],
    ],
    schedule: [
      [-1, "13:00", "18:00", "Aufbau Buden, Beleuchtung, Strom", "Dorfplatz", false],
      [0, "11:00", "14:00", "Standbetreiber bauen auf, Stromabnahme prüfen", "Dorfplatz", false],
      [0, "15:00", null, "Eröffnung des Weihnachtsmarkts", "Dorfplatz", true],
      [0, "15:30", "17:00", "Kinderbasteln", "Gemeindehaus", true],
      [0, "16:00", null, "Auftritt Kinderchor / Kita", "Bühne", true],
      [0, "17:00", null, "Der Nikolaus kommt", "Dorfplatz", true],
      [0, "18:00", null, "Posaunenchor", "Bühne", true],
      [0, "21:00", null, "Ende", null, true],
      [1, "10:00", "13:00", "Abbau", "Dorfplatz", false],
    ],
    material: [
      ["Buden / Pavillons", "8", "Vereine + leihen"], ["Lichterketten und Strahler", null, "Inventar"], ["Stromverteiler, Kabeltrommeln, Kabelbrücken", null, "Inventar / Feuerwehr"],
      ["Glühweinkocher / Warmhaltetöpfe", "3", "Inventar + leihen"], ["Glühweintassen (Pfand)", "300", "Inventar"], ["Spülmöglichkeit für Tassen", null, "Gemeindehaus"],
      ["Bierzeltgarnituren und Stehtische", null, "Inventar (Reservierung im Dorfplaner)"], ["Feuerschalen + Feuerlöscher", null, "Inventar"], ["Nikolauskostüm und Geschenktüten", null, "Inventar + kaufen"],
      ["Musikanlage / Mikrofon", "1", "leihen"], ["Streugut und Schneeschieber", null, "Gemeinde"], ["Kasse und Wechselgeld", null, "Kassenwart"],
    ],
    budget: [
      ["AUSGABE", "Glühwein und Kinderpunsch", 500, VERPF], ["AUSGABE", "Nikolaus-Geschenktüten", 150, PROG], ["AUSGABE", "Budenmiete", 300, "Stände & Buden"],
      ["AUSGABE", "GEMA", 80, ORGA], ["AUSGABE", "Werbung", 60, WERB], ["AUSGABE", "Strom/Material", 100, TECH],
      ["EINNAHME", "Glühweinverkauf", 1400, VERPF], ["EINNAHME", "Standgebühren", 200, "Stände & Buden"],
    ],
  },
];

type Db = Pick<PrismaClient, "template" | "templateArea" | "templateMilestone" | "templateTask" | "templateSlot" | "templateScheduleItem" | "templateMaterialItem" | "templateBudgetItem">;

/** Legt fehlende Standardvorlagen an (nach Name); vorhandene – auch bearbeitete – bleiben unangetastet. */
export async function installStandardTemplates(db: Db, names?: string[]): Promise<string[]> {
  const created: string[] = [];
  for (const t of STANDARD_TEMPLATES) {
    if (names && !names.includes(t.name)) continue;
    if (await db.template.findFirst({ where: { name: t.name } })) continue;
    const tpl = await db.template.create({ data: { name: t.name, description: t.description } });
    const area = new Map<string, number>();
    for (const [i, n] of t.areas.entries()) area.set(n, (await db.templateArea.create({ data: { templateId: tpl.id, name: n, sort: i } })).id);
    const ms: number[] = [];
    for (const [i, [title, offsetDays]] of t.milestones.entries()) ms.push((await db.templateMilestone.create({ data: { templateId: tpl.id, title, offsetDays, sort: i } })).id);
    for (const [i, [title, offsetDays, m, a, description]] of t.tasks.entries())
      await db.templateTask.create({ data: { templateId: tpl.id, title, offsetDays, sort: i, description: description ?? null, milestoneId: m === null ? null : ms[m], areaId: a ? area.get(a) ?? null : null } });
    for (const [i, [title, timeText, capacity, description]] of t.slots.entries()) await db.templateSlot.create({ data: { templateId: tpl.id, title, timeText, capacity, description: description ?? null, sort: i } });
    for (const [dayOffset, time, endTime, title, place, isPublic, note] of t.schedule) await db.templateScheduleItem.create({ data: { templateId: tpl.id, dayOffset, time, endTime, title, place, isPublic, note: note ?? null } });
    for (const [i, [title, quantity, source, note]] of t.material.entries()) await db.templateMaterialItem.create({ data: { templateId: tpl.id, title, quantity, source, note: note ?? null, sort: i } });
    for (const [kind, title, euros, a] of t.budget) await db.templateBudgetItem.create({ data: { templateId: tpl.id, kind, title, plannedCents: euros * 100, areaId: a ? area.get(a) ?? null : null } });
    created.push(t.name);
  }
  return created;
}
