
import { FalkorDB } from "falkordb";

const db = await FalkorDB.connect({
    host: process.env.FALKORDB_HOST || "127.0.0.1",
    port: Number(process.env.FALKORDB_PORT || 6379),
});

export const graph = db.selectGraph("ripple");

export async function closeDatabase() {
    await db.close();
}
