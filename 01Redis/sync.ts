import RedisClass from "../shared/RedisClass.js";
import Transaction from "../shared/TransactionClass.js";
import RedisService from "../shared/RedisService.js";
import { logger } from "../utils/logConfig.js";




export async function syncWorker() {
    logger.info("Syncing pending tasks");

    const client = RedisClass.getInstance().getClient();

    const res = await Transaction.runTransaction(async (tx) => {
        return await tx.query('SELECT * from outbox where stage=$1 and "retryCount"<$2', ['pending', 5])
    })

    for (const item of res.rows) {
        await RedisService.lpush(client, "queue:notification", JSON.stringify({
            type: "redisNotification",
            data: item
        }))
    }
}