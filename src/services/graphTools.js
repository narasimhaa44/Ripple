import { graph } from "../db.js";

export async function listServices() {
    const result = await graph.query(`
    MATCH (s:Service)
    RETURN s.id AS id,
           s.name AS name,
           s.criticality AS criticality
    ORDER BY s.name
  `);

    return (result.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        criticality: row.criticality,
    }));
}

export async function getGraphData(view = "service") {
    const nodesResult = await graph.query(`
        MATCH (n)
        RETURN n.id AS id,
               n.name AS name,
               labels(n)[0] AS type,
               n.criticality AS criticality
        ORDER BY n.name
    `);

    const edgesResult = await graph.query(`
        MATCH (s)-[r]->(t)
        WHERE s.id IS NOT NULL AND t.id IS NOT NULL
        RETURN s.id AS source,
               t.id AS target,
               type(r) AS type,
               s.name AS sourceName,
               t.name AS targetName
    `);

    let nodes = (nodesResult.data ?? []).map((row) => ({
        id: row.id,
        label: row.name || row.id,
        name: row.name || row.id,
        type: row.type || "Service",
        criticality:
            row.criticality !== null && row.criticality !== undefined
                ? Number(row.criticality)
                : null,
    }));

    let edges = (edgesResult.data ?? []).map((row, index) => ({
        id: `e-${row.source}-${row.type}-${row.target}-${index}`,
        source: row.source,
        target: row.target,
        type: row.type,
        sourceName: row.sourceName,
        targetName: row.targetName,
    }));

    if (view === "service") {
        // Service View focuses on Services and their connected infrastructure
        const serviceViewTypes = new Set([
            "Service",
            "Database",
            "Queue",
            "API",
            "ExternalSystem",
        ]);
        nodes = nodes.filter((n) => serviceViewTypes.has(n.type));
        const nodeIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter(
            (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );
    }

    return { nodes, edges };
}

export async function getDegreeCentrality(serviceId = null) {
    const query = serviceId
        ? `
        MATCH (s:Service {id: $serviceId})
        OPTIONAL MATCH (dependent:Service)-[:DEPENDS_ON]->(s)
        OPTIONAL MATCH (s)-[:DEPENDS_ON]->(dependency:Service)
        RETURN s.id AS id,
               s.name AS name,
               s.criticality AS criticality,
               count(DISTINCT dependent) AS inDegree,
               count(DISTINCT dependency) AS outDegree
        `
        : `
        MATCH (s:Service)
        OPTIONAL MATCH (dependent:Service)-[:DEPENDS_ON]->(s)
        OPTIONAL MATCH (s)-[:DEPENDS_ON]->(dependency:Service)
        RETURN s.id AS id,
               s.name AS name,
               s.criticality AS criticality,
               count(DISTINCT dependent) AS inDegree,
               count(DISTINCT dependency) AS outDegree
        ORDER BY inDegree DESC, s.name ASC
        `;

    const result = await graph.query(query, {
        params: serviceId ? { serviceId } : {},
    });

    const rows = result.data ?? [];
    const formatted = rows.map((r) => {
        const inDeg = Number(r.inDegree) || 0;
        const outDeg = Number(r.outDegree) || 0;
        let centralityTier = "LOW";
        if (inDeg >= 2) centralityTier = "CRITICAL_HUB";
        else if (inDeg === 1) centralityTier = "STANDARD";
        else centralityTier = "LEAF_NODE";

        return {
            id: r.id,
            name: r.name,
            criticality: Number(r.criticality) || 1,
            inDegree: inDeg,
            outDegree: outDeg,
            directDependents: inDeg,
            centralityTier,
            centralityLabel: `${inDeg} direct dependent${inDeg === 1 ? "" : "s"}`,
        };
    });

    return serviceId ? formatted[0] || null : formatted;
}
