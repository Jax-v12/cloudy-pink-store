-- Additive metadata only. Existing orders remain visible (archivedAt NULL).
ALTER TABLE `Order` ADD COLUMN `archivedAt` DATETIME(3) NULL;
CREATE INDEX `Order_archivedAt_id_idx` ON `Order`(`archivedAt`, `id`);
CREATE INDEX `Order_type_archivedAt_id_idx` ON `Order`(`type`, `archivedAt`, `id`);

CREATE TABLE `CatalogAudit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `productType` ENUM('APPS', 'GAME', 'ROBLOX') NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `CatalogAudit_productId_id_idx`(`productId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Fail closed on linked stock, even outside the admin endpoint.
-- One ALTER avoids exposing an intermediate unconstrained table.
ALTER TABLE `AccountStock`
    DROP FOREIGN KEY `AccountStock_productId_fkey`,
    ADD CONSTRAINT `AccountStock_productId_restrict_fkey` FOREIGN KEY (`productId`)
    REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
