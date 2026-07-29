import RedisClass from "../shared/RedisClass.js";
import Transaction from "../shared/TransactionClass.js";
import RedisService from "../shared/RedisService.js";
import { logger } from "../utils/logConfig.js";
import type { Redis } from "ioredis";


class SweepOutbox {

    private client: Redis;

    constructor(){
        this.client=RedisClass.getInstance().getClient();
    }

    private async sweep(){
        logger.info("Starting outbox sweep process...");
        try {
            const rows = await Transaction.runTransaction(async (tx) => {
                logger.info("Querying database for pending outbox tasks...");
                const result = await tx.query(`
                    SELECT * FROM outbox 
                    WHERE stage = 'pending' AND "retryCount" < 5 
                    FOR UPDATE SKIP LOCKED
                `);

                if (result.rowCount === 0) {
                    return [];
                }

                logger.info({ count: result.rowCount }, "Found pending tasks to enqueue");

                const ids = result.rows.map(row => row.id);
                await tx.query(`
                    UPDATE outbox 
                    SET stage = 'queued' 
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

    public startOutboxSweeper(intervalMs=30000){
        logger.info(`starting sweeper with ${intervalMs}`)
        setInterval(async()=>{
            await this.sweep();
        },intervalMs)
    }
}

export default SweepOutbox;