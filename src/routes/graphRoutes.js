import { Router } from "express";
import { getGraphData } from "../services/graphTools.js";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const view = req.query.view || "service";
        const graphData = await getGraphData(view);
        res.status(200).json(graphData);
    } catch (error) {
        console.error("Failed to fetch graph data:", error);
        res.status(500).json({
            error: "Failed to retrieve graph data from FalkorDB.",
            details: error.message,
        });
    }
});

export default router;
