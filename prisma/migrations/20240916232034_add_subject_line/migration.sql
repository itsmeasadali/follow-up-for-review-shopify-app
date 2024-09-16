-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewEmailSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "daysToWait" INTEGER NOT NULL DEFAULT 7,
    "emailTemplate" TEXT NOT NULL,
    "subjectLine" TEXT NOT NULL DEFAULT 'We''d love your feedback!'
);
INSERT INTO "new_ReviewEmailSetting" ("daysToWait", "emailTemplate", "enabled", "id", "shopId") SELECT "daysToWait", "emailTemplate", "enabled", "id", "shopId" FROM "ReviewEmailSetting";
DROP TABLE "ReviewEmailSetting";
ALTER TABLE "new_ReviewEmailSetting" RENAME TO "ReviewEmailSetting";
CREATE UNIQUE INDEX "ReviewEmailSetting_shopId_key" ON "ReviewEmailSetting"("shopId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
