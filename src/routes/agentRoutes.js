
import { Router } from "express";
import { askRipple } from "../services/agentService.js";

const router = Router();

router.post("/ask", async (req, res) => {
    try {
        const { question, serviceId } = req.body ?? {};

        if (
            typeof question !== "string" ||
            !question.trim() ||
            question.length > 2000
        ) {
            return res.status(400).json({
                error: "Provide a non-empty question of at most 2000 characters.",
            });
        }

        // serviceId is now optional. The agent can discover services itself.
        if (
            serviceId !== undefined &&
            (typeof serviceId !== "string" ||
                !/^[a-zA-Z0-9_-]{1,100}$/.test(serviceId))
        ) {
            return res.status(400).json({
                error: "Invalid serviceId.",
            });
        }

        const result = await askRipple(question, serviceId);
        return res.json(result);
    } catch (error) {
        console.error("Agent route error:", error.message);

        const notFound = /service not found/i.test(error.message);

        return res.status(notFound ? 404 : 500).json({
            error: notFound
                ? error.message
                : "Ripple could not process the question.",
        });
    }
});

export default router;
