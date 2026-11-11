-- CreateTable
CREATE TABLE "TemplateSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "timeText" TEXT,
    "description" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TemplateSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "endTime" TEXT,
    "title" TEXT NOT NULL,
    "place" TEXT,
    "note" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "responsibleId" INTEGER,
    CONSTRAINT "ScheduleItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleItem_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateScheduleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "endTime" TEXT,
    "title" TEXT NOT NULL,
    "place" TEXT,
    "note" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TemplateScheduleItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" TEXT,
    "source" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "responsibleId" INTEGER,
    CONSTRAINT "MaterialItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialItem_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateMaterialItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" TEXT,
    "source" TEXT,
    "note" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TemplateMaterialItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
