import RedisClass from "../shared/RedisClass.js";
import Transaction from "../shared/TransactionClass.js";
import RedisService from "../shared/RedisService.js";
import { logger } from "../utils/logConfig.js";
import type { Redis } from "ioredis";


class SweepOutbox {

    private client: Redis;

    constructor() {
        this.client = RedisClass.getInstance().getClient();
    }

    private async reapStuckTasks() {
        try {
            await Transaction.runTransaction(async (tx) => {
                const queuedReaped = await tx.query(`
                    UPDATE outbox
                    SET stage = 'pending'::"outboxStage", "updatedAt" = NOW()
                    WHERE stage = 'queued' AND "updatedAt" < NOW() - INTERVAL '2 minutes'
                `);
                if (queuedReaped.rowCount && queuedReaped.rowCount > 0) {
                    logger.warn({ count: queuedReaped.rowCount }, "Reaper: Reclaimed stuck 'queued' tasks back to 'pending'");
                }

                const processingReaped = await tx.query(`
                    UPDATE outbox
                    SET "retryCount" = "retryCount" + 1,
                        stage = (CASE WHEN "retryCount" + 1 >= 5 THEN 'failed' ELSE 'pending' END)::"outboxStage",
                        "updatedAt" = NOW()
                    WHERE stage = 'processing' AND "updatedAt" < NOW() - INTERVAL '5 minutes'
                `);
                if (processingReaped.rowCount && processingReaped.rowCount > 0) {
                    logger.warn({ count: processingReaped.rowCount }, "Reaper: Reclaimed stuck 'processing' tasks back to 'pending' or 'failed'");
                }
            });
        } catch (error) {
            logger.error(error, "Error during reaper cleanup phase");
        }
    }


    private async sweep() {
        logger.info("Starting outbox sweep process...");
        
        await this.reapStuckTasks();

        try {
            const rows = await Transaction.runTransaction(async (tx) => {
                logger.info("Querying database for pending outbox tasks...");
                const result = await tx.query(`
                    SELECT * FROM outbox 
                    WHERE stage = 'pending' AND "retryCount" < 5 
                    FOR UPDATE SKIP LOCKED LIMIT 100
                `);

                if (result.rowCount === 0) {
                    return [];
                }

                logger.info({ count: result.rowCount }, "Found pending tasks to enqueue");

                const ids = result.rows.map(row => row.id);
                await tx.query(`
                    UPDATE outbox 
                    SET stage = 'queued'::"outboxStage", "updatedAt" = NOW()
                    WHERE id = ANY($1)
                `, [ids]);


                logger.info({ ids }, "Updated stage to 'queued' for pending tasks in database");

                return result.rows;
            });

            if (rows.length === 0) {
                logger.info("No pending rows found to sweep.");
                return;
            }

            for (const row of rows) {
                const redisPayload = {
                    type: "redisNotification",
                    data: {
                        ...row,
                        stage: "queued"
                    }
                };
                logger.info({ taskId: row.id }, "Pushing task to Redis queue 'queue:notification'");
                await RedisService.lpush(this.client, "queue:notification", JSON.stringify(redisPayload));
                logger.info({ taskId: row.id }, "Successfully pushed task to Redis queue");
            }
            logger.info(`Sweeper successfully processed ${rows.length} tasks.`);
        } catch (error) {
            logger.error(error, `Error in sweep`);
        }
    }

    public startOutboxSweeper(intervalMs = 30000) {
        logger.info(`starting sweeper with ${intervalMs}`)
        setInterval(async () => {
            await this.sweep();
        }, intervalMs)
    }
}

export default SweepOutbox;