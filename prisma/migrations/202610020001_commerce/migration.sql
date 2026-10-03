-- AlterTable
ALTER TABLE `Product` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `coverImage` TEXT NULL,
    ADD COLUMN `type` ENUM('APPS', 'GAME', 'ROBLOX') NOT NULL DEFAULT 'APPS';

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `checkoutKey` VARCHAR(191) NULL,
    ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    ADD COLUMN `fulfillmentStatus` ENUM('NOT_READY', 'QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'COMPLETED', 'REQUIRES_REVIEW') NOT NULL DEFAULT 'NOT_READY',
    ADD COLUMN `productName` VARCHAR(191) NULL,
    ADD COLUMN `refundReference` TEXT NULL,
    ADD COLUMN `refundStatus` ENUM('NONE', 'REQUIRED', 'COMPLETED') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `requestHash` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('APPS', 'GAME', 'ROBLOX') NOT NULL DEFAULT 'APPS',
    ADD COLUMN `units` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `variantName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `AdminSession` ADD COLUMN `reauthenticatedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `units` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `method` ENUM('GAMEPASS', 'GIFT_USERNAME', 'LOGIN') NULL,
    `gamepassPrice` INTEGER NULL,
    `providerSku` VARCHAR(191) NULL,
    `requiresZone` BOOLEAN NOT NULL DEFAULT false,
    `capacityCheckedAt` DATETIME(3) NULL,

    INDEX `ProductVariant_productId_active_idx`(`productId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameOrderDetail` (
    `orderId` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `zoneId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerSku` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RobloxOrderDetail` (
    `orderId` INTEGER NOT NULL,
    `method` ENUM('GAMEPASS', 'GIFT_USERNAME', 'LOGIN') NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `gamepassUrl` TEXT NULL,
    `gamepassPrice` INTEGER NULL,

    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderSecret` (
    `orderId` INTEGER NOT NULL,
    `ciphertext` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `OrderSecret_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FulfillmentJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `ownerSessionId` VARCHAR(191) NULL,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `attemptedAt` DATETIME(3) NULL,
    `nextRunAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `evidence` TEXT NULL,

    UNIQUE INDEX `FulfillmentJob_orderId_key`(`orderId`),
    UNIQUE INDEX `FulfillmentJob_reference_key`(`reference`),
    INDEX `FulfillmentJob_completedAt_nextRunAt_idx`(`completedAt`, `nextRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jobId` INTEGER NOT NULL,
    `operation` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProviderAttempt_jobId_id_idx`(`jobId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAudit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAudit_orderId_id_idx`(`orderId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkerHeartbeat` (
    `name` VARCHAR(191) NOT NULL,
    `succeededAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Product_type_active_id_idx` ON `Product`(`type`, `active`, `id`);

-- CreateIndex
CREATE UNIQUE INDEX `Order_checkoutKey_key` ON `Order`(`checkoutKey`);

-- CreateIndex
CREATE INDEX `Order_type_fulfillmentStatus_id_idx` ON `Order`(`type`, `fulfillmentStatus`, `id`);

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameOrderDetail` ADD CONSTRAINT `GameOrderDetail_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RobloxOrderDetail` ADD CONSTRAINT `RobloxOrderDetail_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderSecret` ADD CONSTRAINT `OrderSecret_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FulfillmentJob` ADD CONSTRAINT `FulfillmentJob_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProviderAttempt` ADD CONSTRAINT `ProviderAttempt_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `FulfillmentJob`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAudit` ADD CONSTRAINT `AdminAudit_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve product and payment history for existing Apps orders.
UPDATE `Order` o JOIN `Product` p ON p.id = o.productId SET o.productName = p.name;
UPDATE `Order` SET fulfillmentStatus = 'COMPLETED' WHERE status = 'PAID' AND type = 'APPS';
