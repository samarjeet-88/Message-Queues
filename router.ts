import { Router } from "express";
import redisRouter from "./01Redis/router.js";

const router = Router();

router.use("/redis", redisRouter);

export default router;
