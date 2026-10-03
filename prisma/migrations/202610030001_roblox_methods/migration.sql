-- Roblox 3-method checkout: verified identity + gamepass verification metadata.
ALTER TABLE `RobloxOrderDetail` ADD COLUMN `robloxUserId` VARCHAR(32) NULL,
    ADD COLUMN `displayName` VARCHAR(64) NULL,
    ADD COLUMN `gamepassId` VARCHAR(32) NULL,
    ADD COLUMN `gamepassVerifiedAt` DATETIME(3) NULL;

-- Gamepass price is now always derived from the Robux amount: CEIL(units / 0.7).
UPDATE `ProductVariant` SET `gamepassPrice` = CEIL((`units` * 100) / 70) WHERE `method` = 'GAMEPASS';
UPDATE `ProductVariant` SET `gamepassPrice` = NULL WHERE `method` IS NULL OR `method` <> 'GAMEPASS';
