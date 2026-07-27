import { pingDb } from "./db/index.js";
import { logger } from "./logConfig.js";

logger.info("Starting database ping test...");
await pingDb();
process.exit(0);
