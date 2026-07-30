import RedisClass from "../shared/RedisClass.js";
import Transaction from "../shared/TransactionClass.js";
import { logger } from "../utils/logConfig.js";
import type { Redis } from "ioredis";

function parseStreamFields(fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const val = fields[i + 1];
        if (key && val) {
            result[key] = val;
        }
    }
    return result;
}

class StreamWorker {
    private client: Redis;
    private streamName: string;
    private groupName: string;

    constructor() {
        this.client = RedisClass.getInstance().getClient();
        this.streamName = "stream:notification";
        this.groupName = "group-1";
    }

    private async setupConsumerGroup() {
        try {
            await this.client.xgroup("CREATE", this.streamName, this.groupName, "0", "MKSTREAM");
            logger.info(`Created consumer group ${this.groupName} for stream ${this.streamName}`);
        } catch (err: any) {
            if (err && err.message && err.message.includes("BUSYGROUP")) {
                logger.info(`Consumer group ${this.groupName} already exists`);
            } else {
                logger.error(err, "Failed to initialize consumer group");
            }
        }
    }

    private async processMessage(workerName: string, messageId: string, fields: string[]) {
        const parsedFields = parseStreamFields(fields);
        const outboxId = parsedFields["outboxId"];
        const rawPayload = parsedFields["payload"] || "{}";
        const payloadData = JSON.parse(rawPayload).data || {};
        const resId = outboxId || payloadData.id;

        logger.info({ resId, messageId, workerName }, "Processing stream task");

        await Transaction.runTransaction(async (tx) => {
            await tx.query(`
                UPDATE outbox 
                SET stage='processing'::"outboxStage", "performedBy"=$1, "updatedAt"=NOW()
                WHERE id=$2
            `, [workerName, resId]);
        });

        let heartbeatInterval: NodeJS.Timeout | null = setInterval(async () => {
            try {
                await Transaction.runTransaction(async (tx) => {
                    await tx.query(`
                        UPDATE outbox 
                        SET "updatedAt" = NOW() 
                        WHERE id = $1 AND stage = 'processing'::"outboxStage" AND "performedBy" = $2
                    `, [resId, workerName]);
                });
                logger.debug({ resId, workerName }, "Stream worker heartbeat updated");
            } catch (err) {
                logger.error(err, `Heartbeat update failed for task ${resId}`);
            }
        }, 10000);

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
            `, [resId, workerName]);
        });

        if (result.rowCount === 0) {
            logger.warn({ resId, workerName }, "Task lease expired or was reclaimed before completion.");
        } else {
            logger.info(`Completed stream work for ${resId}`);
        }

        await this.client.xack(this.streamName, this.groupName, messageId);
        await this.client.xdel(this.streamName, messageId);
        logger.info({ resId, messageId }, "XACK acknowledged and message deleted from stream");
    }


    private async startWorker(workerName: string) {
        const workerClient = this.client.duplicate();
        logger.info(`Stream worker ${workerName} started`);

        while (true) {
            try {
                // 1. Process new messages from stream (">")
                const response: any = await (workerClient as any).xreadgroup(
                    "GROUP",
                    this.groupName,
                    workerName,
                    "BLOCK",
                    2000,
                    "COUNT",
                    1,
                    "STREAMS",
                    this.streamName,
                    ">"
                );

                if (response && response.length > 0) {
                    const streamData = response[0];
                    const messages = streamData[1];
                    if (messages && messages.length > 0) {
                        const [msgId, msgFields] = messages[0];
                        await this.processMessage(workerName, msgId, msgFields);
                        continue;
                    }
                }

                // 2. If no new messages, claim stale/idle messages (>30s) from PEL
                const claimed: any = await (workerClient as any).xautoclaim(
                    this.streamName,
                    this.groupName,
                    workerName,
                    30000,
                    "0-0",
                    "COUNT",
                    1
                );

                if (claimed && claimed[1] && claimed[1].length > 0) {
                    const [msgId, msgFields] = claimed[1][0];
                    if (msgId && msgFields) {
                        logger.info({ msgId, workerName }, "Worker reclaimed stale PEL message via XAUTOCLAIM");
                        await this.processMessage(workerName, msgId, msgFields);
                    }
                }
            } catch (error) {
                logger.error(error, `Error in stream worker ${workerName}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }




    public async initWorker() {
        await this.setupConsumerGroup();
        this.startWorker("stream-worker-1");
        this.startWorker("stream-worker-2");
        this.startWorker("stream-worker-3");
    }
}

export default StreamWorker;
