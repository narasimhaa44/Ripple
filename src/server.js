import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import impactRoutes from "./routes/impactRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import graphRoutes from "./routes/graphRoutes.js";
import { graph } from "./db.js";
import { discoverMcpTools, callMcpTool } from "./services/mcpClient.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/impact", impactRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/graph", graphRoutes);

// Model Context Protocol (MCP) Endpoints bridged to stdio MCP client
app.get("/api/mcp/tools", async (req, res) => {
    try {
        const tools = await discoverMcpTools();
        res.json({
            protocol: "Model Context Protocol (MCP)",
            version: "2024-11-05",
            transport: "stdio",
            tools,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/mcp", async (req, res) => {
    try {
        const { method, params } = req.body || {};
        if (method === "tools/list") {
            const tools = await discoverMcpTools();
            return res.json({ tools });
        }
        if (method === "tools/call" || req.body.tool) {
            const toolName = params?.name || req.body.tool;
            const args = params?.arguments || req.body.arguments || {};
            const result = await callMcpTool(toolName, args);
            return res.json(result);
        }
        return res.status(400).json({ error: "Unsupported MCP method. Supported: 'tools/list', 'tools/call'" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get("/", (req, res) => {
    res.json({
        project: "Ripple",
        message: "AI What-If Impact Investigator API",
        status: "running",
        mcp: "/api/mcp/tools",
    });
});

app.get("/api/health", async (req, res) => {
    let falkordbStatus = "disconnected";
    try {
        await graph.query("RETURN 1");
        falkordbStatus = "connected";
    } catch {
        falkordbStatus = "disconnected";
    }

    res.json({
        status: "healthy",
        service: "ripple-backend",
        falkordb: falkordbStatus,
        mcp: "enabled",
    });
});

app.listen(PORT, () => {
    console.log(`Ripple API running at http://localhost:${PORT}`);
});
