import { Redis } from 'ioredis'
import { envConfig } from "../utils/envConfig.js";
import { logger } from '../utils/logConfig.js';

class RedisClass {
    private static instance: RedisClass;
    private client: Redis;

    private constructor() {
        const redisHost = envConfig.redisHost;
        const redisPort = envConfig.redisPort;

        this.client = new Redis({
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
            enableReadyCheck: true
        })

        this.client.on("connect", () => {
            logger.info("Redis connected successfully");
        })

        this.client.on("error", (error) => {
            logger.error(error, "Redis connection failed");
        })

    }

    public static getInstance(): RedisClass {
        if (!RedisClass.instance) {
            this.instance = new RedisClass()
        }
        return this.instance
    }

    public getClient(): Redis {
        return this.client;
    }
}

export default RedisClass;