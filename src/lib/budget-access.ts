import { db } from "./db";
import { hasRole, type User } from "./auth";

/** Berechtigungen einer Person für das Budget einer einzelnen Veranstaltung. */
export async function budgetAccess(eventId: number, u: User) {
  const manage = hasRole(u, "ORGANISATOR");
  const member = await db.eventMember.findFirst({ where: { eventId, personId: u.id, role: "FREIGEBER" } });
  const approve = hasRole(u, "ADMIN") || !!member;
  return { manage, approve, isFreigeber: !!member, view: manage || approve };
}
