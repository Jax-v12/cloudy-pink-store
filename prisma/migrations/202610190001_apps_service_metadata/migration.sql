-- Additive only. Apply before the application that selects these fields.
ALTER TABLE `Product` ADD COLUMN `appsConfig` JSON NULL;
ALTER TABLE `Order` ADD COLUMN `appsSnapshot` JSON NULL;

CREATE TABLE `AppsService` (
  `orderId` INTEGER NOT NULL,
  `renewalOfOrderId` INTEGER NULL,
  `deliveryCiphertext` TEXT NULL,
  `deliveredAt` DATETIME(3) NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `activeFrom` DATETIME(3) NULL,
  `activeUntil` DATETIME(3) NULL,
  `activationConfirmedAt` DATETIME(3) NULL,
  `reminderOptIn` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`orderId`),
  INDEX `AppsService_renewalOfOrderId_idx` (`renewalOfOrderId`),
  CONSTRAINT `AppsService_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AppsService_renewalOfOrderId_fkey` FOREIGN KEY (`renewalOfOrderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AppsSupport` (
  `orderId` INTEGER NOT NULL,
  `reason` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`orderId`),
  INDEX `AppsSupport_status_orderId_idx` (`status`, `orderId`),
  CONSTRAINT `AppsSupport_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
