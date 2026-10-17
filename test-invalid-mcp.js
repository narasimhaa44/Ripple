import { callMcpTool } from "./src/services/mcpClient.js";

try {
  const result = await callMcpTool("analyze_impact", {
    serviceId: "svc-does-not-exist",
    maxHops: 2,
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("MCP ERROR:", error.message);
}

process.exit(0);
