import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();


router.post("/notification", asyncHandler(async (req, res) => {
    res.status(202).json({
        success: true,
        message: "Notification request received"
    });
}));

export default router;
