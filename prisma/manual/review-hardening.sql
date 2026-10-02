-- Apply once to an existing MySQL database matching commit a2f9870.
-- Back up first. MySQL DDL commits implicitly. No rows or credentials are deleted.
ALTER TABLE `AccountStock`
  MODIFY `emailAccount` TEXT NOT NULL,
  MODIFY `passwordAccount` TEXT NOT NULL,
  MODIFY `pin` TEXT NULL;
CREATE INDEX `AccountStock_productId_status_idx` ON `AccountStock` (`productId`, `status`);
CREATE INDEX `Order_status_expiresAt_idx` ON `Order` (`status`, `expiresAt`);
CREATE INDEX `Order_status_createdAt_idx` ON `Order` (`status`, `createdAt`);
CREATE INDEX `AdminSession_expiresAt_idx` ON `AdminSession` (`expiresAt`);
CREATE INDEX `RateLimit_expiresAt_idx` ON `RateLimit` (`expiresAt`);
