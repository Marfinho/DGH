import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

type M = [string, number]; type T = [string, number, number | null, string?]; // Titel, Offset, Meilenstein-Index
async function tpl(name: string, description: string, ms: M[], ts: T[]) {
  if (await db.template.findFirst({ where: { name } })) return;
  const t = await db.template.create({ data: { name, description } });
  const ids: number[] = [];
  for (const [i, [title, offsetDays]] of ms.entries()) ids.push((await db.templateMilestone.create({ data: { templateId: t.id, title, offsetDays, sort: i } })).id);
  for (const [i, [title, offsetDays, m, description]] of ts.entries())
    await db.templateTask.create({ data: { templateId: t.id, title, offsetDays, sort: i, description, milestoneId: m === null ? null : ids[m] } });
}

async function main() {
  await tpl("Dorffest", "Großes Fest für das ganze Dorf",
    [["Planung steht", -90], ["Organisation abgeschlossen", -30], ["Aufbau", -1], ["Nachbereitung", 7]],
    [["Termin abstimmen und Platz reservieren", -120, 0], ["Budget aufstellen", -90, 0], ["Genehmigungen / Ordnungsamt anfragen", -75, 0, "Sondernutzung, Schankerlaubnis, ggf. Sperrung"],
     ["Musik / Programm buchen", -60, 1], ["Helfer-Aufruf verteilen", -45, 1], ["Getränke und Essen bestellen", -21, 1], ["Plakate und Ankündigung aushängen", -21, 1],
     ["Technik prüfen (Strom, Tische, Zelt)", -7, 1], ["Aufbau", -1, 2], ["Abbau und Müllentsorgung", 0, null], ["Kasse abrechnen", 3, 3], ["Danke-Treffen mit Helfern", 7, 3]]);
  await tpl("Laternenumzug", "Umzug mit Kindern im Herbst",
    [["Vorbereitung", -30], ["Umzugstag", 0]],
    [["Termin und Route festlegen", -60, 0], ["Feuerwehr und Polizei informieren", -45, 0], ["Musikbegleitung anfragen", -30, 0], ["Bekanntmachung in Kita/Schule", -21, 0],
     ["Streckenposten einteilen", -7, 1], ["Wegstrecke abgehen", -2, 1], ["Aufräumen und Danke sagen", 1, null]]);
}
main().finally(() => db.$disconnect());
