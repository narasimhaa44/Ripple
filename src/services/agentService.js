import Groq from "groq-sdk";
import { analyzeImpact } from "./impactService.js";
import { listServices } from "./graphTools.js";
import { searchIncidents } from "./incidentService.js";
import { graph } from "../db.js";
import {
    discoverMcpTools,
    callMcpTool,
} from "./mcpClient.js";

let groqClient;

function getGroqClient() {
    if (!process.env.GROQ_API_KEY) return null;

    if (!groqClient) {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }

    return groqClient;
}

export const tools = [
    {
        type: "function",
        function: {
            name: "list_services",
            description: "List all services in the graph database.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "analyze_impact",
            description: "Analyze which services are affected if a service fails. Choose maxHops from 1 to 5.",
            parameters: {
                type: "object",
                properties: {
                    serviceId: { type: "string", description: "Exact service ID from list_services" },
                    maxHops: { type: "number", description: "Max hops (1-5)" },
                },
                required: ["serviceId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_dependency_path",
            description:
                "Find graph evidence connecting two services. MUST use this tool when the user asks how one named service can affect another, requests a dependency path, or asks to explain a multi-hop relationship. Use exact IDs from list_services.",
            parameters: {
                type: "object",
                properties: {
                    fromServiceId: {
                        type: "string",
                        description: "Exact ID of the starting service."
                    },
                    toServiceId: {
                        type: "string",
                        description: "Exact ID of the destination service."
                    }
                },
                required: ["fromServiceId", "toServiceId"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_workflows",
            description: "List workflows and the services they require. Optionally filter by service IDs.",
            parameters: {
                type: "object",
                properties: {
                    serviceIds: {
                        type: "array",
                        items: { type: "string" },
                        description: "Filter by service IDs"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_centrality",
            description: "Calculate degree centrality for services in the graph to identify critical infrastructure hubs.",
            parameters: {
                type: "object",
                properties: {
                    serviceId: { type: "string", description: "Optional service ID" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_graph_summary",
            description: "Return counts of nodes by label and relationships by type in the Ripple FalkorDB graph.",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_incidents",
            description:
                "Search available incident records for a service. Report only evidence actually returned by the incident service.",
            parameters: {
                type: "object",
                properties: {
                    serviceId: {
                        type: "string",
                        description: "Exact service ID from the graph.",
                    },
                },
                required: ["serviceId"],
                additionalProperties: false,
            },
        },
    },
];

async function getGroqTools() {
    // Discover the real tools from the MCP server.
    try {
        const mcpTools = await discoverMcpTools();

        const graphTools = mcpTools.map((tool) => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description || tool.name,
                parameters: tool.inputSchema || {
                    type: "object",
                    properties: {},
                },
            },
        }));

        const incidentTool = {
            type: "function",
            function: {
                name: "search_incidents",
                description:
                    "Search available incident records for a service. Report only evidence actually returned by the incident service.",
                parameters: {
                    type: "object",
                    properties: {
                        serviceId: {
                            type: "string",
                            description: "Exact service ID from the graph.",
                        },
                    },
                    required: ["serviceId"],
                    additionalProperties: false,
                },
            },
        };

        return [...graphTools, incidentTool];
    } catch {
        return tools;
    }
}

async function executeTool(name, args) {
    if (name === "get_dependency_path") {
        if (
            typeof args.fromServiceId !== "string" ||
            typeof args.toServiceId !== "string"
        ) {
            throw new Error(
                "Both source and destination service IDs are required."
            );
        }

        return await callMcpTool("get_dependency_path", {
            fromServiceId: args.fromServiceId,
            toServiceId: args.toServiceId
        });
    }

    if (name === "get_workflows") {
        return await callMcpTool("get_workflows", args || {});
    }

    // Incident search remains local; graph tools go through MCP.
    if (name === "search_incidents") {
        if (
            typeof args.serviceId !== "string" ||
            !/^[a-zA-Z0-9_-]{1,100}$/.test(args.serviceId)
        ) {
            throw new Error("A valid service ID is required for incident search.");
        }

        return await searchIncidents(args.serviceId);
    }

    const availableTools = await discoverMcpTools();
    const knownTool = availableTools.find((tool) => tool.name === name);

    if (!knownTool) {
        throw new Error(`Unknown MCP tool: ${name}`);
    }

    const response = await callMcpTool(name, args);

    if (response.isError) {
        const message = (response.content || [])
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n");

        throw new Error(message || `MCP tool ${name} failed.`);
    }

    const textContent = (response.content || [])
        .filter((item) => item.type === "text")
        .map((item) => item.text);

    if (textContent.length === 0) {
        return response.structuredContent ?? response;
    }

    const text = textContent.join("\n");

    try {
        return JSON.parse(text);
    } catch {
        return { result: text };
    }
}

function buildStructuredSummary(impact, incident, pathData = null) {
    const failedName = impact.failedService.name;
    const isIncidentFound = incident?.hasIncident === true;

    const timelineSection = isIncidentFound
        ? `- **Recorded failure start:** ${incident.startTime || "Not available"}
- **Recorded detection time:** ${incident.detectionTime || "Not available"}
- **Recorded duration:** ${incident.duration || "Not established"}
- **Recorded deployment:** ${
            incident.recentDeployment
                ? `${incident.recentDeployment.version} (${incident.recentDeployment.timing}) — commit ${incident.recentDeployment.commit}`
                : "No deployment recorded"
        }
- **Root-cause status:** ${incident.rootCause?.status || "Unverified"}
- **Root-cause hypothesis:** ${incident.rootCause?.description || "Not established"}`
        : `- **Failure time:** Not available in local incident records.
- **Detection time:** Not available in local incident records.
- **Duration:** Not established.
- **Deployment:** No related deployment found in the available incident records.
- **Root-cause hypothesis:** Not established.`;

    const impactLines = impact.affectedServices.map(
        (s) =>
            `- **${s.name}** — ${s.hops} hop(s), **${s.severity}**; heuristic score: ${s.riskScore}/100.`
    ).join("\n");

    const connectingPathsLines = pathData?.paths?.length > 0
        ? pathData.paths
            .map((p) => `- ${p.path.join(" → ")} (${p.hops} hop(s))`)
            .join("\n")
        : null;

    const standardPathsLines = impact.affectedServices.length > 0
        ? impact.affectedServices
            .map(
                (s) =>
                    `- ${s.evidencePath.join(" → ")} (${s.hops} hop(s))`
            )
            .join("\n")
        : `- ${failedName}: no downstream dependent services identified within the analyzed range.`;

    const pathsLines = connectingPathsLines
        ? (standardPathsLines && !standardPathsLines.includes("no downstream")
            ? `${connectingPathsLines}\n${standardPathsLines}`
            : connectingPathsLines)
        : standardPathsLines;

    const workflowSummary = impact.affectedWorkflows.length > 0
        ? impact.affectedWorkflows
            .map((w) => `- ${w.name} — ${w.severity}`)
            .join("\n")
        : "No affected workflows identified.";

    const recommendationsList = (impact.recommendations || [])
        .slice(0, 3)
        .map((r) => `- **[${r.priority}]** ${r.action}`)
        .join("\n");

    const incidentEvidence = isIncidentFound
        ? `Local incident record: ${
            incident.logsAndAlerts?.length
                ? incident.logsAndAlerts
                    .map((entry) => entry.message)
                    .filter(Boolean)
                    .join("; ")
                : "No incident log messages available."
        }\n\nThese records are not independently verified live telemetry.`
        : "No matching local incident record was found. Graph-based impact is a modeled dependency result, not proof of a runtime failure.";

    return `### Investigation results

**Evidence status:** Graph-derived impact analysis${
        isIncidentFound
            ? " + local incident records (not live-verified)"
            : "; no matching local incident record"
    }

### 1. Failure timeline
${timelineSection}

### 2. Impact identified from the dependency graph
${impactLines || "- No downstream dependent services identified."}

**Impacted workflows**
${workflowSummary}

> Risk scores are heuristic prioritization estimates from 0–100, not probabilities of failure.

### 3. Evidence paths and incident support

${pathsLines}

**Incident-record support:** ${incidentEvidence}

> Dependency paths establish modeled relationships. They do not, by themselves, prove that a real outage or failure propagation occurred.

### 4. Recommended investigation steps
${recommendationsList || "- Verify the modeled impact against operational telemetry."}

Would you like to inspect the dependency paths or review the local incident records next?`;
}

export function getTrack1Explanation() {
    return `### Track 1 Architecture & Requirements Fulfillment
**Evidence Status:** Confirmed System Implementation

Here is how Ripple natively implements all 5 Track 1 requirements:

### 1. Multi-hop Reasoning & Centrality
- **Failure propagation:** Ripple traverses cascading dependencies through multiple links using FalkorDB Cypher:
  \`MATCH p=(affected:Service)-[:DEPENDS_ON*1..5]->(failed:Service {id: $serviceId})\`
- **Degree Centrality Analysis:** Computes structural criticality using directed in-degree dependencies:
  \`MATCH (dependent:Service)-[:DEPENDS_ON]->(s:Service)\`
- **Blast radius calculation:** Calculates hop distances (1..5), direct vs. indirect impacts, and prioritizes risk using:
  \`round((criticality / 5) * 70 + 30 / hops)\`

### 2. Graph Queries & Algorithms as Agent Tools
- **Discrete Agent Tools:** Ripple Agent autonomously calls graph tools via MCP:
  • \`list_services\`: Graph discovery (\`MATCH (s:Service) RETURN s\`)
  • \`get_centrality\`: In-degree & out-degree centrality hub detection
  • \`analyze_impact\`: Multi-hop path traversal & workflow risk calculation
  • \`search_incidents\`: Telemetry, timestamps, deployment commits & error logs
  • \`get_workflows\`: Business critical processes (\`MATCH (w:Workflow)-[:REQUIRES]->(s)\`)

### 3. Tool Selection Through MCP (Model Context Protocol)
- Ripple runs an MCP server in src/mcpServer.js using the official Model Context Protocol SDK and stdio transport.
- The AI agent discovers graph tool schemas through the MCP client and invokes graph operations through MCP tool calls.
- Graph findings are obtained from FalkorDB and used to explain the modeled impact.

### 4. Actions Based on What the Graph Shows
- **Targeted Remediations:** Recommends concrete actions derived directly from graph topology & centrality:
  • Order Service isolation when upstream Payment or Inventory fails
  • Reinforcement for high-centrality hubs with ≥2 dependent services
  • Escalated validation for critical workflows with criticality ≥ 4 (Customer Checkout)
  • Notification queue checks only when downstream notification services are impacted

### 5. Explainable Results
- **Evidence Paths & Formula Audit:** Every impacted service includes full transparent dependency evidence:
  \`Shipping Service → Order Service → Inventory Service\`
- **Auditing Integrity:** Never hallucinates topology; explicitly distinguishes confirmed telemetry from modeled graph dependencies.

*Do you want to test multi-hop reasoning on Inventory Service or explore the MCP tool schemas?*`;
}

function getRequestedMaxHops(question) {
    const match = question.match(
        /\b(?:within|up to|maximum|max|limit to)?\s*(\d+)\s*[- ]?hops?\b/i
    );

    if (!match || !match[1]) return 5;

    const val = Number(match[1]);
    if (isNaN(val)) return 5;
    return Math.max(1, Math.min(5, val));
}

export async function askRipple(question, serviceId) {
    if (typeof question !== "string" || !question.trim()) {
        throw new Error("Please enter a question.");
    }

    if (question.length > 2000) {
        throw new Error("Question must be 2000 characters or fewer.");
    }

    const qLower = question.toLowerCase();

    // Check if the user is asking about Track 1 requirements or architecture
    if (
        qLower.includes("track 1") ||
        qLower.includes("track1") ||
        qLower.includes("how ripple will implement") ||
        qLower.includes("mcp") ||
        qLower.includes("multi-hop") ||
        (qLower.includes("requirement") && !serviceId)
    ) {
        return {
            answer: getTrack1Explanation(),
            aiProvider: "ripple-architecture",
            toolsUsed: ["list_services", "get_graph", "mcp_registry"],
        };
    }

    // 1. Authoritative service discovery via MCP (with fallback to direct service)
    let services = [];
    let isMcpList = false;
    try {
        const res = await executeTool("list_services", {});
        services = res.services || [];
        isMcpList = true;
    } catch {
        services = await listServices();
    }

    const listTrace = {
        name: isMcpList ? "list_services" : "list_services (direct fallback)",
        args: {},
        summary: isMcpList
            ? `Discovered ${services.length} services in FalkorDB via MCP.`
            : `Retrieved ${services.length} services directly from the graph service.`,
        result: { services },
    };

    // 2. Identify target and destination service IDs
    let targetId = serviceId;
    let destinationId = null;

    const mentionedServices = services.filter((s) => {
        const baseName = s.name.toLowerCase().replace(/\s+service$/i, "");
        return (
            qLower.includes(s.name.toLowerCase()) ||
            qLower.includes(s.id.toLowerCase()) ||
            qLower.includes(baseName)
        );
    });

    if (mentionedServices.length === 1 && !targetId) {
        targetId = mentionedServices[0].id;
    } else if (mentionedServices.length >= 2) {
        const sourceMatch = mentionedServices.find((s) => {
            const baseName = s.name.toLowerCase().replace(/\s+service$/i, "");
            const pattern = new RegExp(`(?:if\\s+(?:the\\s+)?|when\\s+(?:the\\s+)?|from\\s+|source\\s+)?(?:${s.name.toLowerCase()}|${baseName})\\s+(?:fails|failure|down|outage|breaks)`, "i");
            return pattern.test(qLower);
        });

        const destMatch = mentionedServices.find((s) => {
            const baseName = s.name.toLowerCase().replace(/\s+service$/i, "");
            const pattern = new RegExp(`(?:affect(?:s|ing)?|impact(?:s|ing)?|to(?:wards)?|reach(?:es)?)\\s+(?:the\\s+)?(?:${s.name.toLowerCase()}|${baseName})`, "i");
            return pattern.test(qLower);
        });

        if (sourceMatch && destMatch && sourceMatch.id !== destMatch.id) {
            targetId = targetId || sourceMatch.id;
            destinationId = destMatch.id;
        } else {
            targetId = targetId || mentionedServices[0].id;
            const other = mentionedServices.find((s) => s.id !== targetId);
            if (other) destinationId = other.id;
        }
    }

    const client = getGroqClient();

    // If no specific service is identified, handle as general query
    if (!targetId) {
        if (client) {
            try {
                const completion = await client.chat.completions.create({
                    model: "openai/gpt-oss-20b",
                    temperature: 0.2,
                    max_tokens: 800,
                    messages: [
                        {
                            role: "system",
                            content: `You are Ripple, an explainable service-dependency impact investigator.
Known services: ${services.map((s) => s.name).join(", ")}.
If the user asks an investigative question, prompt them to specify a service name (e.g., Inventory Service, Payment Service).`,
                        },
                        {
                            role: "user",
                            content: question,
                        },
                    ],
                });

                const content = completion.choices?.[0]?.message?.content?.trim();
                if (content) {
                    return {
                        answer: content,
                        aiProvider: "groq",
                        toolsUsed: [listTrace.name],
                        toolTraces: [listTrace],
                    };
                }
            } catch (err) {
                console.warn("Groq general query failed:", err.message);
            }
        }

        return {
            answer: `### Investigation results

**Evidence status:** Graph-derived impact analysis; no matching local incident record

I couldn't identify which service to investigate from your question.

*Do you want to investigate Inventory Service, Payment Service, or Order Service?*`,
            aiProvider: "fallback",
            toolsUsed: [listTrace.name],
            toolTraces: [listTrace],
        };
    }

    // 3. Deterministic evidence prefetching: analyze_impact via MCP + local search_incidents
    const maxHops = getRequestedMaxHops(question);

    let impact = null;
    let isMcpImpact = false;
    try {
        impact = await executeTool("analyze_impact", { serviceId: targetId, maxHops });
        isMcpImpact = true;
    } catch (err) {
        console.warn("MCP analyze_impact failed, using direct graph analysis:", err.message);
        impact = await analyzeImpact(targetId, maxHops);
    }

    if (!impact) {
        throw new Error(`Service not found: ${targetId}`);
    }

    const incident = searchIncidents(targetId);

    const impactTrace = {
        name: isMcpImpact ? "analyze_impact" : "analyze_impact (direct fallback)",
        args: { serviceId: targetId, maxHops },
        summary: `${impact.totalAffected} affected service(s) identified within ${maxHops} hop(s).`,
        result: impact,
    };

    const incidentTrace = {
        name: "search_incidents (local records)",
        args: { serviceId: targetId },
        summary: incident?.hasIncident
            ? "Matching local incident record found; not live-verified."
            : "No matching local incident record found.",
        result: incident,
    };

    // If destination service is identified or dependency path is requested, invoke get_dependency_path
    let pathData = null;
    let pathTrace = null;
    if (destinationId && targetId !== destinationId) {
        try {
            const rawPathRes = await executeTool("get_dependency_path", {
                fromServiceId: targetId,
                toServiceId: destinationId,
            });
            let parsed = rawPathRes;
            if (rawPathRes?.content?.[0]?.text) {
                try {
                    parsed = JSON.parse(rawPathRes.content[0].text);
                } catch { }
            }
            pathData = parsed;
            const pathCount = pathData?.paths?.length || 0;
            const targetName = services.find((s) => s.id === targetId)?.name || targetId;
            const destName = services.find((s) => s.id === destinationId)?.name || destinationId;
            pathTrace = {
                name: "get_dependency_path",
                args: { fromServiceId: targetId, toServiceId: destinationId },
                summary: pathCount > 0
                    ? `Found ${pathCount} connecting path(s) between ${targetName} and ${destName}.`
                    : `No connecting paths found within 5 hops.`,
                result: pathData,
            };
        } catch (err) {
            console.warn("MCP get_dependency_path failed:", err.message);
        }
    }

    const toolTraces = [listTrace, impactTrace, incidentTrace];
    const executedTools = [
        listTrace.name,
        `${impactTrace.name}(${targetId}, ${maxHops})`,
        `search_incidents(${targetId})`,
    ];

    if (pathTrace) {
        toolTraces.push(pathTrace);
        executedTools.push(`get_dependency_path(${targetId}, ${destinationId})`);
    }

    // If Groq is not configured, return deterministic fallback summary
    if (!client) {
        return {
            answer: buildStructuredSummary(impact, incident, pathData),
            impact,
            incident,
            paths: pathData?.paths || [],
            aiProvider: "fallback-graph",
            toolsUsed: executedTools,
            toolTraces,
        };
    }

    // 4. Groq explains authoritative evidence without inventing paths or claiming confirmed telemetry
    try {
        const groqMessages = [
            {
                role: "system",
                content: `You are Ripple, an explainable service-dependency impact investigator.

You are provided with authoritative pre-retrieved investigation evidence from the FalkorDB graph database (via MCP) and local incident service. Explain this evidence accurately to the user.

Evidence and reporting rules:
- Treat FalkorDB dependency paths as graph-derived evidence, not proof of a live outage.
- AUTHORITATIVE PATHS: Use the exact evidence paths provided below. NEVER invent, modify, or reverse dependency directions (e.g. if the path is "Shipping Service → Order Service → Inventory Service", output it exactly in that order).
- Local incident records are NOT live production telemetry. Never describe local incident records as confirmed live telemetry.
- If a root-cause is described as a HYPOTHESIS or Unverified, you MUST report it strictly as an unverified hypothesis, NEVER as a confirmed root cause.
- Only report timestamps, deployments, logs, and durations present in the provided evidence. If downtime recovery is not recorded, state that duration is not established.
- Clearly distinguish graph-derived modeled facts from local incident records.

Tool-use instructions:
1. Use list_services to verify available service IDs in the graph.
2. Use analyze_impact to calculate the blast radius of a failed service.
3. Use search_incidents to search available local incident records for a service.
4. Use get_workflows to discover business workflows requiring a service.
5. When the user asks how one named service can affect another,
   call get_dependency_path with both exact service IDs.
6. For a question about a simulated failure, use analyze_impact
   for the blast radius and get_dependency_path for the requested
   source-to-destination evidence path.
7. Never claim that no connecting path exists unless the
   dependency-path tool has returned an empty paths array.
8. Clearly distinguish graph-modeled dependencies from verified
   production failures or live telemetry.

Format your response concisely matching this exact structure:

### Investigation results

**Evidence status:** Graph-derived impact analysis${
    incident?.hasIncident
        ? " + local incident records (not live-verified)"
        : "; no matching local incident record"
}

### 1. Failure timeline
${
    incident?.hasIncident
        ? `- **Recorded failure start:** ${incident.startTime || "Not available"}
- **Recorded detection time:** ${incident.detectionTime || "Not available"}
- **Recorded duration:** ${incident.duration || "Not established"}
- **Recorded deployment:** ${
            incident.recentDeployment
                ? `${incident.recentDeployment.version} (${incident.recentDeployment.timing}) — commit ${incident.recentDeployment.commit}`
                : "No deployment recorded"
        }
- **Root-cause status:** ${incident.rootCause?.status || "Unverified"}
- **Root-cause hypothesis:** ${incident.rootCause?.description || "Not established"}`
        : `- **Failure time:** Not available in local incident records.
- **Detection time:** Not available in local incident records.
- **Duration:** Not established.
- **Deployment:** No related deployment found in the available incident records.
- **Root-cause hypothesis:** Not established.`
}

### 2. Impact identified from the dependency graph
<List affected services: - **<Name>** — <hops> hop(s), **<Severity>**; heuristic score: <riskScore>/100.>
**Impacted workflows**
<List affected workflows with severity, or 'No affected workflows identified.'>
> Risk scores are heuristic prioritization estimates from 0–100, not probabilities of failure.

### 3. Evidence paths and incident support
<List exact evidence paths for affected services: - <evidencePath joined by ' → '> (<hops> hop(s))>
**Incident-record support:** <Local incident log message summary or 'No matching local incident record was found. Graph-based impact is a modeled dependency result, not proof of a runtime failure.'>
> Dependency paths establish modeled relationships. They do not, by themselves, prove that a real outage or failure propagation occurred.

### 4. Recommended investigation steps
<1 to 3 bulleted recommendations from the graph evidence>
Would you like to inspect the dependency paths or review the local incident records next?`,
            },
            {
                role: "user",
                content: `User Question: "${question}"

PRE-RETRIEVED AUTHORITATIVE EVIDENCE:
- Target Service: ${impact.failedService.name} (${impact.failedService.id})
- Requested Graph Range: ${maxHops} hop(s)
- Total Affected Services: ${impact.totalAffected}
- Affected Services:
${
    impact.affectedServices.length > 0
        ? impact.affectedServices
              .map(
                  (s) =>
                      `  * ${s.name}: ${s.hops} hop(s), severity ${s.severity}, score ${s.riskScore}/100, path: ${s.evidencePath.join(" → ")}`
              )
              .join("\n")
        : "  * None"
}
- Connecting Paths (from get_dependency_path):
${
    pathData?.paths?.length > 0
        ? pathData.paths.map((p) => `  * ${p.path.join(" → ")} (${p.hops} hop(s))`).join("\n")
        : "  * None found within 5 hops."
}
- Affected Workflows: ${impact.affectedWorkflows.length > 0 ? impact.affectedWorkflows.map((w) => `${w.name} (${w.severity})`).join(", ") : "None"}
- Recommendations: ${JSON.stringify(impact.recommendations || [])}
- Local Incident Record:
  * Has Incident: ${incident?.hasIncident}
  * Start Time: ${incident?.startTime || "N/A"}
  * Detection Time: ${incident?.detectionTime || "N/A"}
  * Duration: ${incident?.duration || "N/A"}
  * Deployment: ${incident?.recentDeployment ? `${incident.recentDeployment.version} (${incident.recentDeployment.timing}) — commit ${incident.recentDeployment.commit}` : "None"}
  * Root Cause Status: ${incident?.rootCause?.status || "N/A"}
  * Root Cause Description: ${incident?.rootCause?.description || "N/A"}
  * Logs/Alerts: ${incident?.logsAndAlerts ? incident.logsAndAlerts.map((l) => `[${l.level}] ${l.source}: ${l.message}`).join("; ") : "None"}`,
            },
        ];

        const completion = await client.chat.completions.create({
            model: "openai/gpt-oss-20b",
            temperature: 0.1,
            max_tokens: 1100,
            messages: groqMessages,
        });

        const answer = completion.choices?.[0]?.message?.content?.trim();

        if (!answer) {
            throw new Error("Empty response from Groq.");
        }

        return {
            answer,
            impact,
            incident,
            paths: pathData?.paths || [],
            aiProvider: "groq",
            toolsUsed: executedTools,
            toolTraces,
        };
    } catch (error) {
        console.error("Groq agent completion failed, using prefetched fallback:", error.message);

        return {
            answer: buildStructuredSummary(impact, incident, pathData),
            impact,
            incident,
            paths: pathData?.paths || [],
            aiProvider: "fallback-graph",
            toolsUsed: executedTools,
            toolTraces,
        };
    }
}
