import type { Redis } from "ioredis";



class RedisService {


    static get(client: Redis, key: string): Promise<string | null> {
        return client.get(key);
    }

    static set(client: Redis, key: string, value: string, options?: { ex?: number }): Promise<string | null> {
        const ex = options?.ex ?? 0;
        return client.set(key, value, "EX", ex);
    }

    static lpush(client: Redis, key: string, ...values: string[]): Promise<number> {
        return client.lpush(key, ...values);
    }

    static brpop(client: Redis, key: string, timeout: number = 0): Promise<[string, string] | null> {
        return client.brpop(key, timeout);
    }
}
export default RedisService