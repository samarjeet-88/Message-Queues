import { pool } from "../db/poolConfig.js"
import type { PoolClient, QueryResult } from "pg"


// we can add generic place holder here, but for this we need to define placeholder 
// everytime we will use it

class BaseClass {
    protected async executeQuery(
        sql: string,
        params?: any[],
        connection?: PoolClient
    ): Promise<QueryResult<any>> {
        const runner = connection || pool;
        return runner.query(sql, params)
    }
}

export default BaseClass;