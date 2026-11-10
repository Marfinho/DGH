import { db } from "./db";
import { hasRole, type User } from "./auth";

/** Darf diese Person Termine und Neuigkeiten des Vereins pflegen? Orga/Admin immer, sonst nur der benannte Vorstand. */
export async function canManageGroup(groupId: number, u: User) {
  if (hasRole(u, "ORGANISATOR")) return true;
  return (await db.groupMember.count({ where: { groupId, personId: u.id, role: "VORSTAND" } })) > 0;
}
export async function managedGroupIds(u: User): Promise<number[] | "all"> {
  if (hasRole(u, "ORGANISATOR")) return "all";
  return (await db.groupMember.findMany({ where: { personId: u.id, role: "VORSTAND" }, select: { groupId: true } })).map((m) => m.groupId);
}
