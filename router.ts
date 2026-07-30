import { Router } from "express";
import redisRouter from "./01Redis/router.js";
import redisStreamRouter from "./02RedisStream/router.js";

const router = Router();

router.use("/redis", redisRouter);
router.use("/redis-stream", redisStreamRouter);

export default router;

