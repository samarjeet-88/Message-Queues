import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { randomUUID } from "crypto";
import Transaction from "../shared/TransactionClass.js";
import RedisClass from "../shared/RedisClass.js";
import RedisService from "../shared/RedisService.js";
import { logger } from "../utils/logConfig.js";

const router = Router();


router.post("/notification", asyncHandler(async (req, res) => {
    const { message } = req.body;
    logger.info({ message }, "Received POST /redis/notification request");

    const taskId = randomUUID();
    
    const item = await Transaction.runTransaction(async (tx) => {
        logger.info({ taskId }, "Inserting pending notification to outbox table");
        const result = await tx.query(`
            INSERT INTO outbox (id,stage,"messageType","retryCount",payload)
            VALUES ($1,'pending',$2,0,$3) RETURNING *`,
            [taskId, "notification", JSON.stringify({ message })]
        );

        return result.rows[0]
    });
    logger.info({ taskId }, "Successfully inserted notification into outbox");

    return res.json({ "Notification accepted": item })
}));

export default router;
