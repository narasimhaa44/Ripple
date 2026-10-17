
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(
    new URL("../mcpServer.js", import.meta.url)
);

let client;
let transport;
let connectionPromise;

async function getMcpClient() {
    if (client) return client;

    if (!connectionPromise) {
        connectionPromise = (async () => {
            const nextTransport = new StdioClientTransport({
                command: process.execPath,
                args: [serverPath],
                cwd: process.cwd(),
            });

            const nextClient = new Client({
                name: "ripple-ai-agent",
                version: "1.0.0",
            });

            try {
                await nextClient.connect(nextTransport);

                transport = nextTransport;
                client = nextClient;

                return client;
            } catch (error) {
                await nextTransport.close().catch(() => { });
                throw error;
            }
        })().catch((error) => {
            connectionPromise = undefined;
            throw error;
        });
    }

    return connectionPromise;
}

export async function discoverMcpTools() {
    const mcpClient = await getMcpClient();
    const result = await mcpClient.listTools();

    return result.tools;
}

export async function callMcpTool(name, args = {}) {
    const mcpClient = await getMcpClient();

    return mcpClient.callTool({
        name,
        arguments: args,
    });
}

export async function closeMcpClient() {
    if (client) {
        const currentClient = client;
        client = undefined;
        connectionPromise = undefined;
        transport = undefined;

        await currentClient.close();
    } else if (transport) {
        const currentTransport = transport;
        transport = undefined;
        connectionPromise = undefined;

        await currentTransport.close();
    }
}
