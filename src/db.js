
// import { FalkorDB } from "falkordb";

// const db = await FalkorDB.connect({
//     host: process.env.FALKORDB_HOST || "127.0.0.1",
//     port: Number(process.env.FALKORDB_PORT || 6379),
// });

// export const graph = db.selectGraph("ripple");

// export async function closeDatabase() {
//     await db.close();
// }


import { FalkorDB } from "falkordb";

const connectionOptions = {
    host: process.env.FALKORDB_HOST || "127.0.0.1",
    port: Number(process.env.FALKORDB_PORT || 6379),
};

if (process.env.FALKORDB_USERNAME) {
    connectionOptions.username = process.env.FALKORDB_USERNAME;
}

if (process.env.FALKORDB_PASSWORD) {
    connectionOptions.password = process.env.FALKORDB_PASSWORD;
}

if (process.env.FALKORDB_TLS === "true") {
    connectionOptions.socket = { tls: true };
}

const db = await FalkorDB.connect(connectionOptions);

export const graph = db.selectGraph("ripple");

export async function closeDatabase() {
    await db.close();
}
