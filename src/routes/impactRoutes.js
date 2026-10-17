import { Router } from "express";
import { analyzeImpact } from "../services/impactService.js";

const router = Router();

router.get("/:serviceId", async (req, res) => {
    const serviceId = req.params.serviceId;
    const rawMaxHops = req.query.maxHops ?? "5";

    if (
        typeof serviceId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(serviceId)
    ) {
        return res.status(400).json({
            error: "Invalid service ID.",
            message:
                "Use 1–100 letters, numbers, underscores, or hyphens.",
        });
    }

    // Reject arrays, decimals, zero, negative values, and values above 5.
    if (
        typeof rawMaxHops !== "string" ||
        !/^[1-5]$/.test(rawMaxHops)
    ) {
        return res.status(400).json({
            error: "Invalid hop limit.",
            message: "maxHops must be an integer between 1 and 5.",
        });
    }

    const maxHops = Number(rawMaxHops);

    try {
        const report = await analyzeImpact(serviceId, maxHops);

        if (!report) {
            return res.status(404).json({
                error: "Service not found.",
                serviceId,
            });
        }

        return res.status(200).json(report);
    } catch (error) {
        console.error("Impact analysis failed:", error);

        const statusCode = error.statusCode === 400 ? 400 : 500;

        return res.status(statusCode).json({
            error:
                statusCode === 400
                    ? error.message
                    : "Impact analysis failed.",
        });
    }
});

export default router;
