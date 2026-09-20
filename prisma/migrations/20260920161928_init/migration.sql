-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agnicMerchantId" TEXT,
    "status" TEXT NOT NULL,
    "rail" TEXT,
    "currency" TEXT,
    "exploredAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" SERIAL NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedJson" TEXT NOT NULL,
    "budgetMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalBatch" (
    "id" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "cartsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmationText" TEXT,

    CONSTRAINT "ApprovalBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "supplierName" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "displayItemsJson" TEXT NOT NULL,
    "addressMode" TEXT NOT NULL DEFAULT 'ship_to',
    "shipToJson" TEXT,
    "constraintsJson" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "fulfillmentOptionId" TEXT,
    "userPrompt" TEXT NOT NULL,
    "userConfirmationText" TEXT NOT NULL,
    "userApprovedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "claimedAt" TIMESTAMP(3),
    "agnicOrderId" TEXT,
    "approvalToken" TEXT,
    "approvalUrl" TEXT,
    "approvalExpiresAt" TIMESTAMP(3),
    "dispatchResponseJson" TEXT,
    "orderResponseJson" TEXT,
    "amountChargedMinor" INTEGER,
    "retryable" BOOLEAN,
    "retryabilityKnown" BOOLEAN NOT NULL DEFAULT false,
    "retryAction" TEXT,
    "evidenceScreenshotsCount" INTEGER,
    "evidenceUrl" TEXT,
    "decision" TEXT,
    "decisionReason" TEXT,
    "refusalFigureMinor" INTEGER,
    "refusalCapMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_url_key" ON "Supplier"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_agnicMerchantId_key" ON "Supplier"("agnicMerchantId");

-- CreateIndex
CREATE INDEX "CatalogItem_title_idx" ON "CatalogItem"("title");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_supplierId_sku_key" ON "CatalogItem"("supplierId", "sku");

-- CreateIndex
CREATE INDEX "ApprovalBatch_requestId_createdAt_idx" ON "ApprovalBatch"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_agnicOrderId_key" ON "Approval"("agnicOrderId");

-- CreateIndex
CREATE INDEX "Approval_requestId_createdAt_idx" ON "Approval"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_status_idx" ON "Approval"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_batchId_merchantId_key" ON "Approval"("batchId", "merchantId");

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalBatch" ADD CONSTRAINT "ApprovalBatch_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ApprovalBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
