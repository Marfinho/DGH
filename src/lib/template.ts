import { db } from "./db";
import { addDays, diffDays } from "./dates";

/** Legt Veranstaltung samt Meilensteinen/Aufgaben aus einer Vorlage an; Termine = Eventdatum + Offset. */
export async function createEventFromTemplate(input: { title: string; date: Date; location?: string | null; templateId?: number | null }) {
  const tpl = input.templateId
    ? await db.template.findUnique({ where: { id: input.templateId }, include: { milestones: true, tasks: true, budgetItems: true, areas: true } })
    : null;
  return db.$transaction(async (tx) => {
    const ev = await tx.event.create({ data: { title: input.title, date: input.date, location: input.location || null, templateId: tpl?.id ?? null } });
    if (tpl) {
      const areaMap = new Map<number, number>();
      for (const a of tpl.areas.sort((x, y) => x.sort - y.sort)) areaMap.set(a.id, (await tx.area.create({ data: { eventId: ev.id, name: a.name, sort: a.sort } })).id);
      const map = new Map<number, number>();
      for (const m of tpl.milestones.sort((a, b) => a.sort - b.sort)) {
        const c = await tx.milestone.create({ data: { eventId: ev.id, title: m.title, sort: m.sort, dueDate: addDays(input.date, m.offsetDays) } });
        map.set(m.id, c.id);
      }
      for (const t of tpl.tasks.sort((a, b) => a.sort - b.sort)) {
        await tx.task.create({ data: { eventId: ev.id, title: t.title, description: t.description, sort: t.sort, dueDate: addDays(input.date, t.offsetDays), milestoneId: t.milestoneId ? map.get(t.milestoneId) ?? null : null, areaId: t.areaId ? areaMap.get(t.areaId) ?? null : null } });
      }
    }
    if (tpl) {
      const names = new Map((await tx.area.findMany({ where: { eventId: ev.id } })).map((a) => [a.name, a.id]));
      const tplAreaName = new Map(tpl.areas.map((a) => [a.id, a.name]));
      for (const b of tpl.budgetItems) await tx.budgetItem.create({ data: { eventId: ev.id, kind: b.kind, title: b.title, category: b.category, plannedCents: b.plannedCents, areaId: b.areaId ? names.get(tplAreaName.get(b.areaId) ?? "") ?? null : null } });
    }
    await tx.activityLog.create({ data: { eventId: ev.id, text: tpl ? `Veranstaltung aus Vorlage „${tpl.name}“ angelegt` : "Veranstaltung angelegt" } });
    return ev;
  });
}

/** Speichert die Veranstaltung als neue Vorlage oder überschreibt eine bestehende. Offsets = Fälligkeit − Eventdatum. */
export async function saveEventAsTemplate(eventId: number, target: { newName: string } | { templateId: number }) {
  const ev = await db.event.findUniqueOrThrow({ where: { id: eventId }, include: { milestones: true, tasks: true, budgetItems: true, areas: true } });
  return db.$transaction(async (tx) => {
    let id: number, name: string;
    if ("templateId" in target) {
      const t = await tx.template.update({ where: { id: target.templateId }, data: {} });
      await tx.templateTask.deleteMany({ where: { templateId: t.id } });
      await tx.templateMilestone.deleteMany({ where: { templateId: t.id } });
      await tx.templateBudgetItem.deleteMany({ where: { templateId: t.id } });
      await tx.templateArea.deleteMany({ where: { templateId: t.id } });
      id = t.id; name = t.name;
    } else {
      const t = await tx.template.create({ data: { name: target.newName } });
      id = t.id; name = t.name;
    }
    const areaMap = new Map<number, number>();
    for (const a of ev.areas) areaMap.set(a.id, (await tx.templateArea.create({ data: { templateId: id, name: a.name, sort: a.sort } })).id);
    const map = new Map<number, number>();
    for (const m of ev.milestones) {
      const c = await tx.templateMilestone.create({ data: { templateId: id, title: m.title, sort: m.sort, offsetDays: diffDays(m.dueDate, ev.date) } });
      map.set(m.id, c.id);
    }
    for (const t of ev.tasks) {
      await tx.templateTask.create({ data: { templateId: id, title: t.title, description: t.description, sort: t.sort, offsetDays: diffDays(t.dueDate, ev.date), milestoneId: t.milestoneId ? map.get(t.milestoneId) ?? null : null, areaId: t.areaId ? areaMap.get(t.areaId) ?? null : null } });
    }
    for (const b of ev.budgetItems) await tx.templateBudgetItem.create({ data: { templateId: id, kind: b.kind, title: b.title, category: b.category, plannedCents: b.plannedCents, areaId: b.areaId ? areaMap.get(b.areaId) ?? null : null } });
    await tx.activityLog.create({ data: { eventId, text: `Als Vorlage „${name}“ gespeichert` } });
    return id;
  });
}
