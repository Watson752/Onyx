-- CreateTable
CREATE TABLE "Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agnicMerchantId" TEXT,
    "status" TEXT NOT NULL,
    "rail" TEXT,
    "currency" TEXT,
    "exploredAt" DATETIME
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supplierId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "CatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Request" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rawText" TEXT NOT NULL,
    "parsedJson" TEXT NOT NULL,
    "budgetMinor" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_url_key" ON "Supplier"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_agnicMerchantId_key" ON "Supplier"("agnicMerchantId");

-- CreateIndex
CREATE INDEX "CatalogItem_title_idx" ON "CatalogItem"("title");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_supplierId_sku_key" ON "CatalogItem"("supplierId", "sku");
