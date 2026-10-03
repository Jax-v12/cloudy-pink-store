ALTER TABLE `ProductVariant` ADD COLUMN `maxUnits` INTEGER NULL,
    ADD COLUMN `unitStep` INTEGER NOT NULL DEFAULT 1;

-- Existing Gamepass tariffs become slider rates without changing their price per Robux.
-- Non-multiples of five remain fixed until an admin explicitly configures a valid range.
UPDATE `ProductVariant` SET `maxUnits` = LEAST(GREATEST(`units`, 5000), FLOOR(2147483647 * `units` / `price` / 5) * 5), `unitStep` = 5
WHERE `method` = 'GAMEPASS' AND `units` > 0 AND `units` <= 1000000 AND `price` > 0 AND MOD(`units`, 5) = 0;
