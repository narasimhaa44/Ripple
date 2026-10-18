
import "dotenv/config";
import fs from "node:fs/promises";
import { FalkorDB } from "falkordb";

const required = [
    "CLOUD_FALKORDB_HOST",
    "CLOUD_FALKORDB_PORT",
    "CLOUD_FALKORDB_USERNAME",
    "CLOUD_FALKORDB_PASSWORD",
];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
    }
}

const exportPath = "ripple_graph_export.json";
const file = JSON.parse(await fs.readFile(exportPath, "utf8"));

if (!Array.isArray(file.nodes) || !Array.isArray(file.relationships)) {
    throw new Error("Invalid export file: nodes or relationships are missing.");
}

const ids = file.nodes.map((node) => node.props?.id);

if (
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
) {
    throw new Error("Export contains missing or duplicate node IDs.");
}

const nodeIds = new Set(ids);

for (const node of file.nodes) {
    if (
        !Array.isArray(node.labels) ||
        node.labels.length === 0 ||
        !node.props ||
        typeof node.props !== "object"
    ) {
        throw new Error(`Invalid node in export: ${node.props?.id ?? "unknown"}`);
    }
}

for (const rel of file.relationships) {
    if (
        !rel.source?.id ||
        !rel.target?.id ||
        !nodeIds.has(rel.source.id) ||
        !nodeIds.has(rel.target.id) ||
        typeof rel.type !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rel.type)
    ) {
        throw new Error("Invalid relationship or missing endpoint in export.");
    }
}

const quoteIdentifier = (value) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        throw new Error(`Unsafe graph identifier: ${value}`);
    }
    return `\`${value}\``;
};

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

    const readCount = async (query) => {
        const result = await graph.query(query);
        const value = result.data?.[0]?.count;

        if (value === undefined || value === null) {
            throw new Error(`Could not read count from query: ${query}`);
        }

        return Number(value);
    };

    // Never import into a graph that already has data.
    const existingNodes = await readCount(
        "MATCH (n) RETURN count(n) AS count"
    );
    const existingRels = await readCount(
        "MATCH ()-[r]->() RETURN count(r) AS count"
    );

    if (existingNodes !== 0 || existingRels !== 0) {
        throw new Error(
            `Import stopped: cloud graph has ${existingNodes} nodes and ` +
            `${existingRels} relationships. Use an empty graph.`
        );
    }

    console.log("Empty cloud graph confirmed.");
    console.log("Starting import...");

    for (const node of file.nodes) {
        const labels = node.labels.map(quoteIdentifier).join(":");

        await graph.query(
            `CREATE (n:${labels}) SET n = $props`,
            { params: { props: node.props } }
        );
    }

    console.log(`Created ${file.nodes.length} nodes.`);

    for (const rel of file.relationships) {
        const type = quoteIdentifier(rel.type);

        const result = await graph.query(
            `MATCH (a {id: $sourceId}), (b {id: $targetId})
       CREATE (a)-[r:${type}]->(b)
       SET r = $props`,
            {
                params: {
                    sourceId: rel.source.id,
                    targetId: rel.target.id,
                    props: rel.props ?? {},
                },
            }
        );

        // If a query throws, the import stops and the error is reported.
    }

    console.log(`Processed ${file.relationships.length} relationships.`);

    const nodeCount = await readCount(
        "MATCH (n) RETURN count(n) AS count"
    );
    const relCount = await readCount(
        "MATCH ()-[r]->() RETURN count(r) AS count"
    );

    console.log("Cloud nodes:", nodeCount);
    console.log("Cloud relationships:", relCount);

    if (
        nodeCount !== file.nodes.length ||
        relCount !== file.relationships.length
    ) {
        throw new Error(
            "Verification failed. Do not rerun the import; inspect the cloud graph."
        );
    }

    console.log("SUCCESS: Cloud graph matches the export!");
} finally {
    await db.close();
}
