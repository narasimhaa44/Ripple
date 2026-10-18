
import "dotenv/config";
import { FalkorDB } from "falkordb";
import fs from "node:fs/promises";

const db = await FalkorDB.connect({
    host: process.env.FALKORDB_HOST || "127.0.0.1",
    port: Number(process.env.FALKORDB_PORT || 6379),
    ...(process.env.FALKORDB_USERNAME && {
        username: process.env.FALKORDB_USERNAME,
    }),
    ...(process.env.FALKORDB_PASSWORD && {
        password: process.env.FALKORDB_PASSWORD,
    }),
    ...(process.env.FALKORDB_TLS === "true" && {
        socket: { tls: true },
    }),
});

try {
    const graph = db.selectGraph("ripple");

    const nodesResult = await graph.query(
        "MATCH (n) RETURN labels(n) AS labels, properties(n) AS props"
    );

    const relationshipsResult = await graph.query(
        `MATCH (a)-[r]->(b)
     RETURN properties(a) AS source,
            type(r) AS type,
            properties(r) AS props,
            properties(b) AS target`
    );

    const nodes = nodesResult.data ?? [];
    const relationships = relationshipsResult.data ?? [];

    await fs.writeFile(
        "ripple_graph_export.json",
        JSON.stringify({ nodes, relationships }, null, 2),
        "utf8"
    );

    console.log("Nodes exported:", nodes.length);
    console.log("Relationships exported:", relationships.length);
    console.log("File: ripple_graph_export.json");
} finally {
    await db.close();
}
