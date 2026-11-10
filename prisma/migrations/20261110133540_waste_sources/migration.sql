-- CreateTable
CREATE TABLE "WasteSource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "lastOk" BOOLEAN NOT NULL DEFAULT true,
    "lastMessage" TEXT,
    "lastCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WasteDate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "sourceId" INTEGER,
    CONSTRAINT "WasteDate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WasteSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WasteDate" ("date", "id", "type") SELECT "date", "id", "type" FROM "WasteDate";
DROP TABLE "WasteDate";
ALTER TABLE "new_WasteDate" RENAME TO "WasteDate";
CREATE UNIQUE INDEX "WasteDate_type_date_key" ON "WasteDate"("type", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
