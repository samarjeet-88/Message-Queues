import { Pool } from "pg";
import { db } from "../utils/envConfig.js";

export const pool = new Pool({
  connectionString: db.dbUrl,

  statement_timeout: 30000,
  query_timeout: 35000,
  lock_timeout: 5000,
  idle_in_transaction_session_timeout: 60000,

  max: 80,
  min: 50,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,

  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
