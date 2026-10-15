-- Additive only: historical orders remain NULL. Application encrypts new LOGIN contacts.
ALTER TABLE `RobloxOrderDetail` ADD COLUMN `whatsappE164` VARCHAR(255) NULL;
