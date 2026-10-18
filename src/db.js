
import "dotenv/config";
import { FalkorDB } from "falkordb";

const isProduction = process.env.NODE_ENV === "production";

const prefix = isProduction ? "CLOUD_FALKORDB" : "FALKORDB";

const host = process.env[`${prefix}_HOST`];
const port = process.env[`${prefix}_PORT`];
const username = process.env[`${prefix}_USERNAME`];
const password = process.env[`${prefix}_PASSWORD`];
const tls = process.env[`${prefix}_TLS`];

if (!host || !port) {
    throw new Error(
        `Missing ${prefix}_HOST or ${prefix}_PORT environment variable`
    );
}

const connectionOptions = {
    host,
    port: Number(port),
};

if (username) connectionOptions.username = username;
if (password) connectionOptions.password = password;

if (tls === "true") {
    connectionOptions.socket = { tls: true };
}

const db = await FalkorDB.connect(connectionOptions);

export const graph = db.selectGraph("ripple");

export async function closeDatabase() {
    await db.close();
}
