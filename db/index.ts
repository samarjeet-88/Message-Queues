import type { PoolClient } from "pg";
import { pool } from "./poolConfig.js";
import { logger } from "../utils/logConfig.js";


export const getDBConnection = async (retries = 3): Promise<PoolClient> => {
  let client: PoolClient | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      client = await pool.connect();

      await client.query("SELECT 1");
      return client;
    } catch (error) {
      if (client) {
        client.release(true);
        client = null;
      }

      logger.warn(`Database connection attempt ${attempt}/${retries} failed. Discarding connection. Error: ${error instanceof Error ? error.message : String(error)}`);

      if (attempt === retries) {
        throw error;
      }
    }
  }
  throw new Error("Failed to acquire a healthy database connection");
};

export const pingDb = async () => {
  try {
    const client = await getDBConnection();
    client.release();
    logger.info("Database ping successful");
    return true;
  } catch (error) {
    logger.error(error, "Database connection failed");
    return false;
  }
};
