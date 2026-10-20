-- Additive only. Existing orders keep paidAt = NULL (warranty shows help info, no fabricated date).
ALTER TABLE `Order` ADD COLUMN `paidAt` DATETIME(3) NULL;

-- Telegram webhook dedupe receipts: metadata only, never message text or OTP codes.
CREATE TABLE `TelegramUpdateReceipt` (
  `updateId` BIGINT NOT NULL,
  `orderId` INTEGER NULL,
  `requestId` INTEGER NULL,
  `outcome` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `TelegramUpdateReceipt_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`updateId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
