-- Retire stored Roblox credentials while preserving orders, payments and fulfillment jobs.
START TRANSACTION;

INSERT INTO `AdminAudit` (`orderId`, `sessionId`, `action`, `createdAt`)
SELECT o.`id`, 'system:login-policy', 'assisted-login-required', CURRENT_TIMESTAMP(3)
FROM `Order` o JOIN `OrderSecret` s ON s.`orderId` = o.`id`
WHERE o.`type` = 'ROBLOX';

UPDATE `Order` o JOIN `OrderSecret` s ON s.`orderId` = o.`id`
SET o.`fulfillmentStatus` = 'WAITING_CUSTOMER'
WHERE o.`type` = 'ROBLOX' AND o.`status` = 'PAID' AND o.`refundStatus` = 'NONE'
AND o.`fulfillmentStatus` IN ('QUEUED', 'PROCESSING');

DELETE s FROM `OrderSecret` s JOIN `Order` o ON s.`orderId` = o.`id`
WHERE o.`type` = 'ROBLOX';

COMMIT;
