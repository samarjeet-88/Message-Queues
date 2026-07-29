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
        // next time transfer this to env
        this.queueName = 'queue:notification'
    }


    private async startWorker(workerName: string) {
        const workerClient = this.client.duplicate();
        logger.info(`worker ${workerName} started`);
        let res: any = null;

        while (true) {
            try {
                const item = await RedisService.brpop(workerClient, this.queueName);
                if (!item) {
                    logger.info("No Item to process");
                    continue;
                }

                res = JSON.parse(item[1]).data;

                logger.info(`Starting the work for ${res.id}`);

                // next time directly import the enum itself or make an enum in typescript
                await Transaction.runTransaction(async (tx) => {
                    await tx.query(`
                        UPDATE outbox set stage='processing',"performedBy"=$1
                        where id=$2
                    `, [workerName, res.id])
                });

                await new Promise(resolve => setTimeout(resolve, 2000))

                await Transaction.runTransaction(async (tx) => {
                    await tx.query(`
                        UPDATE outbox set stage='success' where id=$1`,
                        [res.id]
                    )
                });

            } catch (error) {
                logger.error(error, `Error in worker ${workerName}`);
                if (res) {
                    await Transaction.runTransaction(async (tx) => {
                        await tx.query(`
                        UPDATE outbox SET "retryCount"=$1, 
                        stage=CASE
                            WHEN $1>=5  THEN 'failed' 
                            ELSE 'pending'
                        END
                        WHERE id=$2`,
                            [res.retryCount + 1, res.id])
                    })
                }
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
