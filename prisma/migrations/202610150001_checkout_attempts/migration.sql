-- Draft for review only. Never applied by the local implementation task.
-- Additive authorization/attempt metadata; existing Order/RobloxOrderDetail data stays intact.
CREATE TABLE `CheckoutSession` (
  `id` CHAR(36) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  UNIQUE INDEX `CheckoutSession_tokenHash_key` (`tokenHash`),
  INDEX `CheckoutSession_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CheckoutAttempt` (
  `id` CHAR(36) NOT NULL,
  `sessionId` CHAR(36) NOT NULL,
  `flowId` CHAR(36) NOT NULL,
  `checkoutKey` VARCHAR(128) NOT NULL,
  `productId` INTEGER NOT NULL,
  `variantId` INTEGER NOT NULL,
  `state` ENUM('READY', 'PROCESSING', 'COMMITTED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'READY',
  `version` INTEGER NOT NULL DEFAULT 0,
  `requestHash` CHAR(64) NULL,
  `quoteSnapshot` JSON NULL,
  `leaseUntil` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `orderId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CheckoutAttempt_checkoutKey_key` (`checkoutKey`),
  UNIQUE INDEX `CheckoutAttempt_orderId_key` (`orderId`),
  UNIQUE INDEX `CheckoutAttempt_sessionId_flowId_key` (`sessionId`, `flowId`),
  INDEX `CheckoutAttempt_sessionId_productId_state_idx` (`sessionId`, `productId`, `state`),
  INDEX `CheckoutAttempt_state_leaseUntil_idx` (`state`, `leaseUntil`),
  INDEX `CheckoutAttempt_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CheckoutAttempt_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `CheckoutSession` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CheckoutAttempt_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
