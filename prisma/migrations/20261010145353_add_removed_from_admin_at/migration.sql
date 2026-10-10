-- AlterTable
ALTER TABLE `Order` ADD COLUMN `removedFromAdminAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_removedFromAdminAt_id_idx` ON `Order`(`removedFromAdminAt`, `id`);

-- CreateIndex
CREATE INDEX `Order_type_removedFromAdminAt_id_idx` ON `Order`(`type`, `removedFromAdminAt`, `id`);
