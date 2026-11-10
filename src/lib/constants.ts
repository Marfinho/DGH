export const TASK_STATUS = ["OFFEN", "IN_ARBEIT", "ERLEDIGT"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];
export const TASK_LABEL: Record<TaskStatus, string> = { OFFEN: "Offen", IN_ARBEIT: "In Arbeit", ERLEDIGT: "Erledigt" };

export const EVENT_STATUS = ["GEPLANT", "DURCHGEFUEHRT", "ARCHIVIERT"] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];
export const EVENT_LABEL: Record<EventStatus, string> = { GEPLANT: "Geplant", DURCHGEFUEHRT: "Durchgeführt", ARCHIVIERT: "Archiviert" };
