import RedisClass from "../shared/RedisClass.js";
import Transaction from "../shared/TransactionClass.js";
import { logger } from "../utils/logConfig.js";
import type { Redis } from "ioredis";

class StreamSweepOutbox {
    private client: Redis;
    private streamName: string;

    constructor() {
        this.client = RedisClass.getInstance().getClient();
        this.streamName = "stream:notification";
    }

    private async reapStuckTasks() {
        try {
            await Transaction.runTransaction(async (tx) => {
                const queuedReaped = await tx.query(`
                    UPDATE outbox
                    SET stage = 'pending'::"outboxStage", "updatedAt" = NOW()
                    WHERE stage = 'queued'::"outboxStage" 
                    AND "messageType" = 'notification-redis-stream'
                    AND "updatedAt" < NOW() - INTERVAL '2 minutes'
                `);
                if (queuedReaped.rowCount && queuedReaped.rowCount > 0) {
                    logger.warn({ count: queuedReaped.rowCount }, "StreamReaper: Reclaimed stuck 'queued' tasks back to 'pending'");
                }

                const stuckTasks = await tx.query(`
                    SELECT id, "streamId" FROM outbox
                    WHERE stage = 'processing'::"outboxStage"
                    AND "messageType" = 'notification-redis-stream'
                    AND "updatedAt" < NOW() - INTERVAL '5 minutes'
                `);

                for (const task of stuckTasks.rows) {
                    if (task.streamId) {
                        try {
                            await this.client.xack(this.streamName, "group-1", task.streamId);
                            await this.client.xdel(this.streamName, task.streamId);
                            logger.info({ taskId: task.id, streamId: task.streamId }, "StreamReaper: Purged old stream message from PEL");
                        } catch (redisErr) {
                            logger.error(redisErr, `StreamReaper: Error purging stream message ${task.streamId}`);
                        }
                    }
                }

                const processingReaped = await tx.query(`
                    UPDATE outbox
                    SET "retryCount" = "retryCount" + 1,
                        stage = (CASE WHEN "retryCount" + 1 >= 5 THEN 'failed' ELSE 'pending' END)::"outboxStage",
                        "updatedAt" = NOW()
                    WHERE stage = 'processing'::"outboxStage" 
                    AND "messageType" = 'notification-redis-stream'
                    AND "updatedAt" < NOW() - INTERVAL '5 minutes'
                `);
                if (processingReaped.rowCount && processingReaped.rowCount > 0) {
                    logger.warn({ count: processingReaped.rowCount }, "StreamReaper: Reclaimed stuck 'processing' tasks back to 'pending' or 'failed'");
                }
            });
        } catch (error) {
            logger.error(error, "Error during stream reaper cleanup phase");
        }
    }


    private async sweep() {
        logger.info("Starting outbox stream sweep process...");
        
        await this.reapStuckTasks();

        try {
            const rows = await Transaction.runTransaction(async (tx) => {
                const result = await tx.query(`
                    SELECT * FROM outbox 
                    WHERE stage = 'pending'::"outboxStage" 
                    AND "messageType" = 'notification-redis-stream'
                    AND "retryCount" < 5 
                    FOR UPDATE SKIP LOCKED LIMIT 100
                `);

                if (result.rowCount === 0) {
                    return [];
                }

                const ids = result.rows.map(row => row.id);
                await tx.query(`
                    UPDATE outbox 
                    SET stage = 'queued'::"outboxStage", "updatedAt" = NOW()
                    WHERE id = ANY($1)
                `, [ids]);

                return result.rows;
            });

            if (rows.length === 0) {
                return;
            }

            for (const row of rows) {
                const redisPayload = JSON.stringify({
                    type: "redisStreamNotification",
                    data: {
                        ...row,
                        stage: "queued"
                    }
                });
                logger.info({ taskId: row.id }, "Adding task to Redis Stream 'stream:notification'");
                const streamId: any = await this.client.xadd(this.streamName, "*", "outboxId", row.id, "payload", redisPayload);
                logger.info({ taskId: row.id, streamId }, "Successfully added task to Redis Stream");

                await Transaction.runTransaction(async (tx) => {
                    await tx.query(`UPDATE outbox SET "streamId" = $1 WHERE id = $2`, [streamId, row.id]);
                });
            }
            logger.info(`Stream sweeper successfully processed ${rows.length} tasks.`);
        } catch (error) {
            logger.error(error, "Error in stream sweep");
        }
    }


    public startStreamSweeper(intervalMs = 30000) {
        logger.info(`Starting stream sweeper with interval ${intervalMs}ms`);
        setInterval(async () => {
            await this.sweep();
        }, intervalMs);
    }
}

export default StreamSweepOutbox;
