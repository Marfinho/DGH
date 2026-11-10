-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Person" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'BEWOHNER',
    "calToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "wastePush" BOOLEAN NOT NULL DEFAULT false,
    "wasteTypes" TEXT,
    "groupId" INTEGER,
    CONSTRAINT "Person_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Person" ("calToken", "createdAt", "email", "groupId", "id", "lastLoginAt", "name", "phone", "role") SELECT "calToken", "createdAt", "email", "groupId", "id", "lastLoginAt", "name", "phone", "role" FROM "Person";
DROP TABLE "Person";
ALTER TABLE "new_Person" RENAME TO "Person";
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");
CREATE UNIQUE INDEX "Person_calToken_key" ON "Person"("calToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
