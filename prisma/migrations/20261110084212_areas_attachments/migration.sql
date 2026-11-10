-- CreateTable
CREATE TABLE "Area" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "leadId" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Area_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Area_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateArea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TemplateArea_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "budgetItemId" INTEGER,
    "name" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BudgetItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "plannedCents" INTEGER NOT NULL,
    "actualCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ENTWURF',
    "note" TEXT,
    "requestedById" INTEGER,
    "decidedById" INTEGER,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "areaId" INTEGER,
    CONSTRAINT "BudgetItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetItem_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetItem_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetItem_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BudgetItem" ("actualCents", "category", "createdAt", "decidedAt", "decidedById", "decisionNote", "eventId", "id", "kind", "note", "paidAt", "plannedCents", "requestedById", "status", "title") SELECT "actualCents", "category", "createdAt", "decidedAt", "decidedById", "decisionNote", "eventId", "id", "kind", "note", "paidAt", "plannedCents", "requestedById", "status", "title" FROM "BudgetItem";
DROP TABLE "BudgetItem";
ALTER TABLE "new_BudgetItem" RENAME TO "BudgetItem";
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventId" INTEGER NOT NULL,
    "milestoneId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "assigneeId" INTEGER,
    "areaId" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "description", "dueDate", "eventId", "id", "milestoneId", "sort", "status", "title") SELECT "assigneeId", "description", "dueDate", "eventId", "id", "milestoneId", "sort", "status", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_TemplateBudgetItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "plannedCents" INTEGER NOT NULL,
    "areaId" INTEGER,
    CONSTRAINT "TemplateBudgetItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemplateBudgetItem_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TemplateArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TemplateBudgetItem" ("category", "id", "kind", "plannedCents", "templateId", "title") SELECT "category", "id", "kind", "plannedCents", "templateId", "title" FROM "TemplateBudgetItem";
DROP TABLE "TemplateBudgetItem";
ALTER TABLE "new_TemplateBudgetItem" RENAME TO "TemplateBudgetItem";
CREATE TABLE "new_TemplateTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "milestoneId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "offsetDays" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "areaId" INTEGER,
    CONSTRAINT "TemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemplateTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "TemplateMilestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TemplateTask_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TemplateArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TemplateTask" ("description", "id", "milestoneId", "offsetDays", "sort", "templateId", "title") SELECT "description", "id", "milestoneId", "offsetDays", "sort", "templateId", "title" FROM "TemplateTask";
DROP TABLE "TemplateTask";
ALTER TABLE "new_TemplateTask" RENAME TO "TemplateTask";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Area_eventId_name_key" ON "Area"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateArea_templateId_name_key" ON "TemplateArea"("templateId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storedName_key" ON "Attachment"("storedName");
