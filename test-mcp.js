
import {
    discoverMcpTools,
    closeMcpClient,
} from "./src/services/mcpClient.js";

try {
    const tools = await discoverMcpTools();

    console.log("\nDiscovered MCP tools:");

    for (const tool of tools) {
        console.log(`- ${tool.name}: ${tool.description}`);
    }

    console.log(`\nTotal tools discovered: ${tools.length}`);
} catch (error) {
    console.error("MCP discovery failed:", error);
    process.exitCode = 1;
} finally {
    await closeMcpClient().catch(() => { });
}
