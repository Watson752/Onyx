-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "exploreError" TEXT,
ADD COLUMN     "exploreOrderId" TEXT,
ADD COLUMN     "explorePhase" TEXT NOT NULL DEFAULT 'done';
