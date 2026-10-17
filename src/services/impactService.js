
import { graph } from "../db.js";

const MAX_HOPS = 5;

// This is a prioritization heuristic, not a failure probability.
function calculateRisk(criticality, hops) {
    const c = Math.max(1, Math.min(5, Number(criticality) || 1));

    const score = Math.round(
        (c / 5) * 70 + 30 / Math.max(1, hops)
    );

    return Math.max(0, Math.min(100, score));
}

function getSeverity(score) {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";
    return "LOW";
}

function getWorkflowSeverity(criticality) {
    if (criticality >= 5) return "CRITICAL";
    if (criticality >= 4) return "HIGH";
    if (criticality >= 3) return "MEDIUM";
    return "LOW";
}

function buildRecommendations(failed, affectedServices, workflows) {
    const recommendations = [];

    recommendations.push({
        priority: "HIGH",
        action: `Check the health and availability of ${failed.name}.`,
        reason: `${failed.name} is the service selected for failure simulation.`,
    });

    const orderService = affectedServices.find(
        (service) => service.id === "svc-order"
    );

    if (orderService) {
        const isHub = orderService.inDegree >= 2;
        recommendations.push({
            priority: "HIGH",
            action:
                `Verify ${orderService.name} behavior and its handling of ` +
                `${failed.name} dependency failures.`,
            reason:
                `${orderService.name} is downstream of ${failed.name} ` +
                `in the discovered dependency path: ` +
                orderService.evidencePath.join(" -> ") + "." +
                (isHub
                    ? ` Centrality alert: ${orderService.inDegree} services depend on ${orderService.name}.`
                    : ` Centrality note: ${orderService.inDegree || 0} direct dependent(s).`),
            evidenceSource: "Graph Traversal & Centrality Analysis",
        });
    }

    // Centrality-driven recommendations for other critical dependency hubs (inDegree >= 2)
    const highCentralityServices = affectedServices.filter(
        (service) => service.inDegree >= 2 && service.id !== "svc-order"
    );

    for (const hub of highCentralityServices) {
        recommendations.push({
            priority: "CRITICAL",
            action: `Isolate and reinforce ${hub.name} (${hub.inDegree} dependent services).`,
            reason: `${hub.name} is a high-centrality dependency hub with ${hub.inDegree} direct dependents in the graph. Failure here cascades along path: ${hub.evidencePath.join(" -> ")}.`,
            evidenceSource: `Degree Centrality Algorithm (in-degree: ${hub.inDegree})`,
        });
    }

    const notificationService = affectedServices.find(
        (service) => service.id === "svc-notification"
    );

    if (notificationService) {
        recommendations.push({
            priority: "MEDIUM",
            action:
                "Check notification retries, delivery failures, and queue backlogs.",
            reason:
                `${notificationService.name} is downstream of ${failed.name} ` +
                `in the discovered dependency path: ` +
                notificationService.evidencePath.join(" -> ") + ".",
        });
    }

    const criticalWorkflows = workflows.filter(
        (workflow) => workflow.criticality >= 4
    );

    if (criticalWorkflows.length > 0) {
        recommendations.push({
            priority: "HIGH",
            action:
                "Prioritize validation of affected critical workflows: " +
                criticalWorkflows.map((workflow) => workflow.name).join(", ") +
                ".",
            reason:
                "These affected workflows have a criticality rating of 4 or 5.",
        });
    }

    recommendations.push({
        priority: "MEDIUM",
        action:
            "Check dependency health, timeouts, retries, and fallback behavior.",
        reason:
            "The graph shows dependency relationships but does not verify " +
            "whether retries, redundancy, or fallbacks are configured.",
    });

    return recommendations;
}

export async function analyzeImpact(serviceId, maxHops = MAX_HOPS) {
    const normalizedId =
        typeof serviceId === "string" ? serviceId.trim() : "";

    // Validate service ID.
    if (
        !normalizedId ||
        normalizedId.length > 100 ||
        !/^[a-zA-Z0-9_-]+$/.test(normalizedId)
    ) {
        const error = new Error(
            "A valid service ID is required. Use letters, numbers, underscores, or hyphens."
        );
        error.statusCode = 400;
        throw error;
    }

    // Validate hop limit.
    if (
        !Number.isInteger(maxHops) ||
        maxHops < 1 ||
        maxHops > MAX_HOPS
    ) {
        const error = new Error(
            "maxHops must be an integer between 1 and 5."
        );
        error.statusCode = 400;
        throw error;
    }

    // Only the validated hop count is interpolated into the query.
    const result = await graph.query(
        `MATCH (failed:Service {id: $serviceId})
     OPTIONAL MATCH p=(affected:Service)-[:DEPENDS_ON*1..${maxHops}]->(failed)
     WITH failed, affected, p
     RETURN
       failed.id AS failedServiceId,
       failed.name AS failedService,
       failed.criticality AS failedCriticality,
       affected.id AS affectedServiceId,
       affected.name AS affectedService,
       affected.criticality AS affectedCriticality,
       CASE WHEN p IS NULL THEN 0 ELSE length(p) END AS hops,
       CASE WHEN p IS NULL THEN []
            ELSE [n IN nodes(p) | n.name] END AS evidencePath,
       CASE WHEN p IS NULL THEN []
            ELSE [n IN nodes(p) | n.id] END AS evidencePathIds`,
        {
            params: { serviceId: normalizedId },
        }
    );

    const rows = result.data ?? [];

    if (rows.length === 0 || !rows[0].failedServiceId) {
        return null;
    }

    // Calculate degree centrality across the graph
    const centralityResult = await graph.query(`
        MATCH (s:Service)
        OPTIONAL MATCH (dependent:Service)-[:DEPENDS_ON]->(s)
        OPTIONAL MATCH (s)-[:DEPENDS_ON]->(dependency:Service)
        RETURN s.id AS id,
               count(DISTINCT dependent) AS inDegree,
               count(DISTINCT dependency) AS outDegree
    `);

    const centralityMap = new Map();
    for (const cRow of centralityResult.data ?? []) {
        centralityMap.set(cRow.id, {
            inDegree: Number(cRow.inDegree) || 0,
            outDegree: Number(cRow.outDegree) || 0,
        });
    }

    const failedCent = centralityMap.get(rows[0].failedServiceId) || { inDegree: 0, outDegree: 0 };
    const failed = {
        id: rows[0].failedServiceId,
        name: rows[0].failedService,
        criticality: Number(rows[0].failedCriticality) || 1,
        inDegree: failedCent.inDegree,
        outDegree: failedCent.outDegree,
        centralityTier: failedCent.inDegree >= 2 ? "CRITICAL_HUB" : failedCent.inDegree === 1 ? "STANDARD" : "LEAF_NODE",
        centralityLabel: `${failedCent.inDegree} direct dependent${failedCent.inDegree === 1 ? "" : "s"}`,
    };

    // Keep the shortest discovered path for each affected service.
    const serviceMap = new Map();

    for (const row of rows) {
        if (!row.affectedServiceId) continue;

        const service = {
            id: row.affectedServiceId,
            name: row.affectedService,
            criticality: Number(row.affectedCriticality) || 1,
            hops: Number(row.hops),
            evidencePath: row.evidencePath,
            evidencePathIds: row.evidencePathIds || [],
            pathNodes: (row.evidencePathIds || []).map((id, idx) => ({
                id,
                name: row.evidencePath?.[idx] || id,
            })),
        };

        const existing = serviceMap.get(service.id);

        if (!existing || service.hops < existing.hops) {
            serviceMap.set(service.id, service);
        }
    }

    const affectedServices = [...serviceMap.values()]
        .map((service) => {
            const cent = centralityMap.get(service.id) || { inDegree: 0, outDegree: 0 };
            const inDegree = cent.inDegree;
            const outDegree = cent.outDegree;
            const centralityTier = inDegree >= 2 ? "CRITICAL_HUB" : inDegree === 1 ? "STANDARD" : "LEAF_NODE";
            const centralityLabel = `${inDegree} direct dependent${inDegree === 1 ? "" : "s"}`;

            const riskScore = calculateRisk(
                service.criticality,
                service.hops
            );
            const severity = getSeverity(riskScore);

            const explanation = {
                criticality: service.criticality,
                hops: service.hops,
                inDegree,
                formula: "round((criticality / 5) * 70 + 30 / hops)",
                scoreType: "Heuristic Prioritization Score (not a probability of failure)",
                calculatedScore: riskScore,
                severity,
                severityThreshold: ">= 80 CRITICAL | >= 60 HIGH | >= 35 MEDIUM | < 35 LOW",
                pathDescription: `${service.name} is ${service.hops} hop(s) downstream from ${failed.name} via ${service.evidencePath.join(" → ")}.`,
                centralityDescription: `${service.name} has ${inDegree} direct dependent service(s) in the graph (${inDegree >= 2 ? "High-centrality hub" : inDegree === 1 ? "Standard dependency" : "Leaf node"}).`,
                evidenceSource: `FalkorDB Cypher Traversal [1..${maxHops} hops]`,
            };

            return {
                ...service,
                inDegree,
                outDegree,
                centralityTier,
                centralityLabel,
                riskScore,
                severity,
                explanation,
            };
        })
        .sort(
            (a, b) =>
                b.riskScore - a.riskScore ||
                a.hops - b.hops ||
                a.name.localeCompare(b.name)
        );

    // Find workflows requiring the failed service or affected services.
    const serviceIds = [
        failed.id,
        ...affectedServices.map((service) => service.id),
    ];

    const workflowResult = await graph.query(
        `MATCH (w:Workflow)-[:REQUIRES]->(s:Service)
     WHERE s.id IN $serviceIds
     RETURN DISTINCT
       w.id AS id,
       w.name AS name,
       w.criticality AS criticality`,
        {
            params: { serviceIds },
        }
    );

    const workflows = (workflowResult.data ?? [])
        .map((workflow) => {
            const criticality = Number(workflow.criticality) || 1;

            return {
                id: workflow.id,
                name: workflow.name,
                criticality,
                severity: getWorkflowSeverity(criticality),
            };
        })
        .sort((a, b) => b.criticality - a.criticality);

    const recommendations = buildRecommendations(
        failed,
        affectedServices,
        workflows
    );

    return {
        generatedAt: new Date().toISOString(),
        analysisType: "graph-based what-if simulation",
        maxHops,

        riskModel: {
            name: "criticality-distance heuristic",
            formula: "round((criticality / 5) * 70 + 30 / hops)",
            scoreType: "Heuristic Prioritization Score (0-100)",
            note:
                "Scores are heuristic prioritization estimates to rank investigation order. " +
                "They are NOT probabilities of failure or runtime failure predictions.",
        },

        failedService: failed,
        totalAffected: affectedServices.length,
        affectedServices,

        totalAffectedWorkflows: workflows.length,
        affectedWorkflows: workflows,

        recommendations,

        limitations: [
            "Impact is inferred from dependency relationships.",
            "The graph does not establish actual runtime failure.",
            "Fallbacks and redundancy are not verified by this analysis.",
        ],
    };
}
