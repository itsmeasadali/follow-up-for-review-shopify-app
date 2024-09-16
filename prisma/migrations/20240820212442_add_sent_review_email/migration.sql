-- CreateTable
CREATE TABLE "SentReviewEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SentReviewEmail_shopId_orderId_key" ON "SentReviewEmail"("shopId", "orderId");
