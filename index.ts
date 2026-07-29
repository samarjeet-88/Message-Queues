import express from "express";
import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { pingDb } from "./db/index.js";
import { logger } from "./utils/logConfig.js";
import swaggerUi from "swagger-ui-express";
import { swaggerDocument } from "./utils/swagger.js";
import globalRouter from "./router.js";
import SweepOutbox from "./01Redis/sweep.js";
import queueWorker from "./01Redis/worker.js";
import RedisClass from "./shared/RedisClass.js";

const app = express();

app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

app.use(globalRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({ message: "Not Found" });
});

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    logger.error(err, "Error occurred during request processing");
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
};

app.use(errorHandler);

app.listen(3000, () => {
    logger.info("Server is running on port 3000");
    pingDb().then(async () => {
        logger.info("Database connected successfully")
        try {
            await RedisClass.getInstance().getClient();
            logger.info("Redis connected successfully")
            
            const sweeper = new SweepOutbox();
            sweeper.startOutboxSweeper();
            logger.info("Outbox sweeper initialized.");
        } catch (error) {
            logger.error(`Error starting outbox sweeper: ${error}`)
        }
        const worker = new queueWorker();
        worker.initWorker();
        logger.info("Background workers initialized.");
    }).catch((error) => {
        logger.error("Database connection failed", error)
    })
})