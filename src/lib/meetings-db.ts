import { db } from "./db";
import { protocolText } from "./meetings";

export const protocolInclude = {
  agenda: { orderBy: [{ sort: "asc" as const }, { id: "asc" as const }] },
  invitees: { orderBy: { name: "asc" as const }, include: { person: { select: { email: true } } } },
  todos: { orderBy: { createdAt: "asc" as const }, include: { assignee: { select: { name: true } } } },
};
export type FullMeeting = Awaited<ReturnType<typeof loadFull>>;
export const loadFull = (id: number) => db.meeting.findUniqueOrThrow({ where: { id }, include: protocolInclude });
export function protocolFromDb(m: FullMeeting) {
  const idx = new Map(m.agenda.map((a, i) => [a.id, i]));
  return protocolText({
    meeting: m, present: m.invitees.filter((i) => i.present).map((i) => i.name), absent: m.invitees.filter((i) => !i.present).map((i) => i.name),
    agenda: m.agenda, todos: m.todos.map((t) => ({ title: t.title, who: t.assignee?.name ?? null, due: t.dueDate, agendaIndex: t.agendaItemId != null ? idx.get(t.agendaItemId) ?? null : null })),
  });
}
