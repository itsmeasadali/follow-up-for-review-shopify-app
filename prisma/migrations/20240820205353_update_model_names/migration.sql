/*
  Warnings:

  - You are about to drop the `ReviewEmailSettings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReviewListings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ReviewEmailSettings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ReviewListings";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ReviewEmailSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "daysToWait" INTEGER NOT NULL DEFAULT 7,
    "emailTemplate" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewEmailSetting_shopId_key" ON "ReviewEmailSetting"("shopId");

-- CreateIndex
CREATE INDEX "ReviewListing_shopId_idx" ON "ReviewListing"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewListing_shopId_platform_key" ON "ReviewListing"("shopId", "platform");
