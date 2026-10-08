-- Additive migration. Existing amounts are IDR; do not convert or reprice historical orders.
ALTER TABLE `Order`
  ADD COLUMN `pricingRegion` VARCHAR(2) NOT NULL DEFAULT 'ID',
  ADD COLUMN `productSubtotal` INTEGER NULL,
  ADD COLUMN `paymentFee` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `discount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `paymentProvider` VARCHAR(32) NOT NULL DEFAULT 'MIDTRANS',
  ADD COLUMN `paymentReference` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Order_paymentReference_key` ON `Order`(`paymentReference`);
UPDATE `Order` SET `productSubtotal` = `totalAmount` WHERE `currency` = 'IDR';
CREATE TABLE `RegionalPrice` (
  `variantId` INTEGER NOT NULL,
  `region` VARCHAR(2) NOT NULL,
  `amount` INTEGER NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (`variantId`, `region`),
  CONSTRAINT `RegionalPrice_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- No MYR/PHP seed prices: each must be explicitly configured by the merchant.
