-- Expand only. Runtime must remain unpublished until this migration is applied.
ALTER TABLE `AppsService`
  ADD COLUMN `reminderPhone` TEXT NULL,
  ADD COLUMN `reminderConsentAt` DATETIME(3) NULL,
  ADD COLUMN `reminderVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `reminderLanguage` VARCHAR(2) NOT NULL DEFAULT 'ID',
  ADD INDEX `AppsService_reminderOptIn_activeUntil_idx` (`reminderOptIn`, `activeUntil`);

CREATE TABLE `AppsReminder` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orderId` INTEGER NOT NULL,
  `daysBefore` INTEGER NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `dueAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `attemptedAt` DATETIME(3) NULL,
  `acceptedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AppsReminder_orderId_daysBefore_periodEnd_key` (`orderId`, `daysBefore`, `periodEnd`),
  INDEX `AppsReminder_status_dueAt_idx` (`status`, `dueAt`),
  CONSTRAINT `AppsReminder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `AppsService` (`orderId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Only daily, bounded counters. No event records, identifiers, contacts, paths or URLs.
CREATE TABLE `AggregateMetric` (
  `day` DATE NOT NULL,
  `area` VARCHAR(16) NOT NULL,
  `metric` VARCHAR(24) NOT NULL,
  `bucket` VARCHAR(24) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`day`, `area`, `metric`, `bucket`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
