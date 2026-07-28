import BaseClass from "./BaseClass.js";
import { getDBConnection } from "../db/index.js"
import type { PoolClient, QueryResult } from "pg";
import { logger } from "../utils/logConfig.js";

class Transaction extends BaseClass {

    private client: PoolClient;

    private constructor(client: PoolClient) {
        super();
        this.client = client;
    }

    static async start() {
        const client = await getDBConnection();
        await client.query('BEGIN');
        return new Transaction(client);
    }

    static async runTransaction(fn: (tx: Transaction) => Promise<any>): Promise<any> {
        const tx = await Transaction.start();
        try {
            const result = await fn(tx);
            await tx.commit();
            return result;
        } catch (error) {
            await tx.rollback();
            throw error;
        }
    }

    async query(sql: string, params?: any[]): Promise<QueryResult<any>> {
        return this.executeQuery(sql, params, this.client)
    }

    async commit() {
        try {
            await this.client.query("COMMIT");
        } finally {
            this.client.release();
        }
    }

    async rollback() {
        try {
            await this.client.query("ROLLBACK");
        } catch (err) {
            logger.error(err, "Error during rollback");
        } finally {
            this.client.release();
        }
    }
}




export default Transaction