
import "dotenv/config";
import { FalkorDB } from "falkordb";

const host = process.env.FALKORDB_HOST;
const port = process.env.FALKORDB_PORT;
const username = process.env.FALKORDB_USERNAME;
const password = process.env.FALKORDB_PASSWORD;
const tls = process.env.FALKORDB_TLS;

if (!host || !port) {
    throw new Error(
        "Missing FALKORDB_HOST or FALKORDB_PORT environment variable"
    );
}

const connectionOptions = {
    host: host.trim(),
    port: Number(port),
};

if (
    !Number.isInteger(connectionOptions.port) ||
    connectionOptions.port < 1 ||
    connectionOptions.port > 65535
) {
    throw new Error("Invalid FALKORDB_PORT configuration.");
}

if (username) connectionOptions.username = username;
if (password) connectionOptions.password = password;

if (String(tls).toLowerCase() === "true") {
    connectionOptions.socket = { tls: true };
}

const db = await FalkorDB.connect(connectionOptions);

export const graph = db.selectGraph("ripple");

export async function closeDatabase() {
    await db.close();
}
