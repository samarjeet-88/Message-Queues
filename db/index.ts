import { pool } from "./poolConfig.js";
import { logger } from "../logConfig.js";

export const pingDb = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT NOW()");
    client.release();
    logger.info(`Database ping successful: ${res.rows[0]?.now}`);
    return true;
  } catch (error) {
    logger.error(error, "Database connection failed");
    return false;
  }
};
