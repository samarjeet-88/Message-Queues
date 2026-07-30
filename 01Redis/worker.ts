import RedisClass from "../shared/RedisClass.js";
import RedisService from "../shared/RedisService.js";
import Transaction from "../shared/TransactionClass.js";
import { logger } from "../utils/logConfig.js";
import type { Redis } from "ioredis";


class queueWorker {

    private client: Redis;
    private queueName: string;

    constructor() {
        this.client = RedisClass.getInstance().getClient();
        this.queueName = 'queue:notification';
    }


    private async startWorker(workerName: string) {
        const workerClient = this.client.duplicate();
        logger.info(`worker ${workerName} started`);

        while (true) {
            let res: any = null;
            let heartbeatInterval: NodeJS.Timeout | null = null;

            try {
                const item = await RedisService.brpop(workerClient, this.queueName);
                if (!item) {
                    logger.info("No Item to process");
                    continue;
                }

                res = JSON.parse(item[1]).data;

                logger.info(`Starting the work for ${res.id}`);

                await Transaction.runTransaction(async (tx) => {
                    await tx.query(`
                        UPDATE outbox 
                        SET stage='processing'::"outboxStage", "performedBy"=$1, "updatedAt"=NOW()
                        WHERE id=$2
                    `, [workerName, res.id]);
                });

                heartbeatInterval = setInterval(async () => {
                    try {
                        await Transaction.runTransaction(async (tx) => {
                            await tx.query(`
                                UPDATE outbox 
                                SET "updatedAt" = NOW() 
                                WHERE id = $1 AND stage = 'processing'::"outboxStage" AND "performedBy" = $2
                            `, [res.id, workerName]);
                        });
                        logger.debug({ taskId: res.id, workerName }, "Heartbeat updated");
                    } catch (err) {
                        logger.error(err, `Heartbeat update failed for task ${res.id}`);
                    }
                }, 10000);


                // HERE THERE IS A CLASSIC PROBLEM THAT HAPPENS IF THE SERVICE IS SUCCESSFUL BUT WHEN UPDATING THE DATABASE ROW TO STATUS SUCCESS IT FAILS, THAN THE REAPER FUNCTION WILL THINK THAT THE WORKER CRASHED SO IT WILL PROCESS THIS AGAIN. THIS IS NOT IDEMPOTENT TO SOLVE THIS WE CAN SEND A IDEMPOTENT KEY TO THE EXTERNAL SERVICE WHICH WILL RECORD AFTER SUCESSFULL COMPLETION, SO WHEN THIS TASK IS AGAIN PROCESSED BY THIS EXTERNAL SERVICE IT WILL SEE THAT THE TASK HAS ALREADY BEEN PROCESSED AND WILL NOT PROCESS IT AGAIN
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } finally {
                    if (heartbeatInterval) {
                        clearInterval(heartbeatInterval);
                    }
                }

                const result = await Transaction.runTransaction(async (tx) => {
                    return await tx.query(`
                        UPDATE outbox 
                        SET stage='success'::"outboxStage", "updatedAt"=NOW() 
                        WHERE id=$1 AND stage='processing'::"outboxStage" AND "performedBy"=$2
                    `, [res.id, workerName]);
                });

                if (result.rowCount === 0) {
                    logger.warn({ taskId: res.id, workerName }, "Task lease expired or was reclaimed by Reaper before completion.");
                } else {
                    logger.info(`Completed work for ${res.id}`);
                }

            } catch (error) {
                logger.error(error, `Error in worker ${workerName}`);
            }
        }
    }

    public initWorker() {
        this.startWorker("worker-1");
        this.startWorker("worker-2");
        this.startWorker("worker-3");
    }
}

export default queueWorker;

