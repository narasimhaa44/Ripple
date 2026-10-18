
import "dotenv/config";
import { FalkorDB } from "falkordb";

const db = await FalkorDB.connect({
    host: process.env.CLOUD_FALKORDB_HOST,
    port: Number(process.env.CLOUD_FALKORDB_PORT),
    username: process.env.CLOUD_FALKORDB_USERNAME,
    password: process.env.CLOUD_FALKORDB_PASSWORD,
    ...(process.env.CLOUD_FALKORDB_TLS === "true" && {
        socket: { tls: true },
    }),
});

try {
    const graph = db.selectGraph("ripple");

    const nodeIds = await graph.query(
        `MATCH (n)
     RETURN n.id AS id, count(n) AS copies
     ORDER BY copies DESC`
    );

    const relationshipTypes = await graph.query(
        `MATCH ()-[r]->()
     RETURN type(r) AS type, count(r) AS copies
     ORDER BY copies DESC`
    );

    console.log("NODE IDS AND COUNTS:");
    console.log(JSON.stringify(nodeIds.data, null, 2));

    console.log("RELATIONSHIP TYPES AND COUNTS:");
    console.log(JSON.stringify(relationshipTypes.data, null, 2));
} catch (error) {
    console.error("Diagnostic failed:", error.message);
} finally {
    await db.close();
}
