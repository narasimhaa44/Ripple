
// import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { z } from "zod";

// import { graph, closeDatabase } from "./db.js";
// import { analyzeImpact } from "./services/impactService.js";
// import { listServices, getDegreeCentrality } from "./services/graphTools.js";

// const server = new McpServer({
//   name: "ripple-graph-tools",
//   version: "1.0.0",
// });

// const serviceIdSchema = z
//   .string()
//   .trim()
//   .min(1, "Service ID cannot be empty")
//   .max(100, "Service ID cannot exceed 100 characters")
//   .regex(
//     /^[a-zA-Z0-9_-]+$/,
//     "Service ID can contain only letters, numbers, underscores, and hyphens"
//   );

// function errorResult(message) {
//   return {
//     isError: true,
//     content: [
//       {
//         type: "text",
//         text: message,
//       },
//     ],
//   };
// }

// function successResult(data) {
//   return {
//     content: [
//       {
//         type: "text",
//         text: JSON.stringify(data),
//       },
//     ],
//   };
// }

// async function serviceExists(serviceId) {
//   const result = await graph.query(
//     `
//     MATCH (s:Service {id: $serviceId})
//     RETURN s.id AS id
//     LIMIT 1
//     `,
//     {
//       params: { serviceId },
//     }
//   );

//   return (result.data ?? []).length > 0;
// }

// // 1. List all services
// server.registerTool(
//   "list_services",
//   {
//     title: "List Services",
//     description:
//       "List all services in Ripple's FalkorDB graph, including their IDs and criticality.",
//     inputSchema: {},
//   },
//   async () => {
//     try {
//       const services = await listServices();
//       return successResult({ services });
//     } catch (error) {
//       console.error("list_services failed:", error.message);
//       return errorResult("Unable to list services. Please check the graph database connection.");
//     }
//   }
// );

// // 2. Analyze the impact of a service failure
// server.registerTool(
//   "analyze_impact",
//   {
//     title: "Analyze Failure Impact",
//     description:
//       "Analyze which services are affected if a service fails. Choose maxHops from 1 to 5. Returns affected services and evidence paths from FalkorDB.",
//     inputSchema: {
//       serviceId: serviceIdSchema,
//       maxHops: z.number().int().min(1).max(5).default(2),
//     },
//   },
//   async ({ serviceId, maxHops = 2 }) => {
//     try {
//       const exists = await serviceExists(serviceId);

//       if (!exists) {
//         return errorResult(
//           `Service "${serviceId}" was not found. Use list_services to check valid service IDs.`
//         );
//       }

//       const result = await analyzeImpact(serviceId, maxHops);

//       if (!result) {
//         return errorResult(
//           `Impact analysis returned no result for "${serviceId}".`
//         );
//       }

//       return successResult(result);
//     } catch (error) {
//       console.error("analyze_impact failed:", error.message);
//       return errorResult(
//         `Unable to analyze impact for "${serviceId}". Please check the service ID and graph database.`
//       );
//     }
//   }
// );

// // 3. Find dependency paths between two services
// server.registerTool(
//   "get_dependency_path",
//   {
//     title: "Find Dependency Paths",
//     description:
//       "Find dependency paths from one service to another using DEPENDS_ON relationships in FalkorDB. Paths follow the stored relationship direction.",
//     inputSchema: {
//       fromServiceId: serviceIdSchema,
//       toServiceId: serviceIdSchema,
//     },
//   },
//   async ({ fromServiceId, toServiceId }) => {
//     try {
//       const [fromExists, toExists] = await Promise.all([
//         serviceExists(fromServiceId),
//         serviceExists(toServiceId),
//       ]);

//       if (!fromExists) {
//         return errorResult(
//           `Source service "${fromServiceId}" was not found. Use list_services to check valid service IDs.`
//         );
//       }

//       if (!toExists) {
//         return errorResult(
//           `Destination service "${toServiceId}" was not found. Use list_services to check valid service IDs.`
//         );
//       }

//       const result = await graph.query(
//         `
//         MATCH p=(a:Service {id: $fromId})-[:DEPENDS_ON*1..5]->
//                 (b:Service {id: $toId})
//         RETURN [n IN nodes(p) | n.name] AS path,
//                length(p) AS hops
//         ORDER BY hops
//         LIMIT 5
//         `,
//         {
//           params: {
//             fromId: fromServiceId,
//             toId: toServiceId,
//           },
//         }
//       );

//       return successResult({
//         fromServiceId,
//         toServiceId,
//         paths: result.data ?? [],
//       });
//     } catch (error) {
//       console.error("get_dependency_path failed:", error.message);
//       return errorResult(
//         "Unable to find dependency paths. Please check the graph database and service IDs."
//       );
//     }
//   }
// );

// // 4. Find related workflows
// server.registerTool(
//   "get_workflows",
//   {
//     title: "Find Related Workflows",
//     description:
//       "List workflows and the services they require. Optionally filter by service IDs to identify potentially affected workflows.",
//     inputSchema: {
//       serviceIds: z.array(serviceIdSchema).max(50).optional(),
//     },
//   },
//   async ({ serviceIds }) => {
//     try {
//       if (serviceIds?.length) {
//         const checks = await Promise.all(
//           serviceIds.map(async (serviceId) => ({
//             serviceId,
//             exists: await serviceExists(serviceId),
//           }))
//         );

//         const unknownIds = checks
//           .filter((item) => !item.exists)
//           .map((item) => item.serviceId);

//         if (unknownIds.length) {
//           return errorResult(
//             `Unknown service ID(s): ${unknownIds.join(", ")}. Use list_services to check valid service IDs.`
//           );
//         }
//       }

//       const result = await graph.query(
//         `
//         MATCH (w:Workflow)-[:REQUIRES]->(s:Service)
//         WITH w, collect(DISTINCT {
//           id: s.id,
//           name: s.name
//         }) AS services
//         WHERE $filterEnabled = false
//            OR any(svc IN services WHERE svc.id IN $serviceIds)
//         RETURN w.id AS id,
//                w.name AS name,
//                services
//         ORDER BY name
//         `,
//         {
//           params: {
//             filterEnabled: Boolean(serviceIds?.length),
//             serviceIds: serviceIds ?? [],
//           },
//         }
//       );

//       return successResult({
//         workflows: result.data ?? [],
//       });
//     } catch (error) {
//       console.error("get_workflows failed:", error.message);
//       return errorResult(
//         "Unable to retrieve workflows. Please check the graph database connection."
//       );
//     }
//   }
// );

// // 5. Summarize graph nodes and relationships
// server.registerTool(
//   "get_graph_summary",
//   {
//     title: "Summarize Graph",
//     description:
//       "Return counts of nodes by label and relationships by type in the Ripple FalkorDB graph.",
//     inputSchema: {},
//   },
//   async () => {
//     try {
//       const [nodesResult, edgesResult] = await Promise.all([
//         graph.query(`
//           MATCH (n)
//           UNWIND labels(n) AS label
//           RETURN label, count(*) AS count
//           ORDER BY label
//         `),
//         graph.query(`
//           MATCH ()-[r]->()
//           RETURN type(r) AS relationshipType, count(*) AS count
//           ORDER BY relationshipType
//         `),
//       ]);

//       return successResult({
//         nodesByLabel: nodesResult.data ?? [],
//         relationshipsByType: edgesResult.data ?? [],
//       });
//     } catch (error) {
//       console.error("get_graph_summary failed:", error.message);
//       return errorResult(
//         "Unable to summarize the graph. Please check the graph database connection."
//       );
//     }
//   }
// );

// // 6. Calculate degree centrality of services
// server.registerTool(
//   "get_centrality",
//   {
//     title: "Get Degree Centrality",
//     description:
//       "Calculate degree centrality (in-degree direct dependents and out-degree dependencies) for services in the graph to identify critical infrastructure hubs.",
//     inputSchema: {
//       serviceId: serviceIdSchema.optional(),
//     },
//   },
//   async ({ serviceId } = {}) => {
//     try {
//       if (serviceId) {
//         const exists = await serviceExists(serviceId);
//         if (!exists) {
//           return errorResult(
//             `Service "${serviceId}" was not found. Use list_services to check valid service IDs.`
//           );
//         }
//       }

//       const centrality = await getDegreeCentrality(serviceId || null);
//       return successResult({ centrality });
//     } catch (error) {
//       console.error("get_centrality failed:", error.message);
//       return errorResult(
//         "Unable to calculate degree centrality. Please check the graph database connection."
//       );
//     }
//   }
// );

// // Start the MCP server over stdio
// const transport = new StdioServerTransport();

// try {
//   await server.connect(transport);
//   console.error("Ripple MCP server connected over stdio.");
// } catch (error) {
//   console.error("Failed to start Ripple MCP server:", error);
//   await closeDatabase().catch(() => { });
//   process.exitCode = 1;
// }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { graph, closeDatabase } from "./db.js";
import { analyzeImpact } from "./services/impactService.js";
import { listServices, getDegreeCentrality } from "./services/graphTools.js";

const server = new McpServer({
  name: "ripple-graph-tools",
  version: "1.0.0",
});

const serviceIdSchema = z
  .string()
  .trim()
  .min(1, "Service ID cannot be empty")
  .max(100, "Service ID cannot exceed 100 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Service ID can contain only letters, numbers, underscores, and hyphens"
  );

function errorResult(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}

function successResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}

async function serviceExists(serviceId) {
  const result = await graph.query(
    `
    MATCH (s:Service {id: $serviceId})
    RETURN s.id AS id
    LIMIT 1
    `,
    {
      params: { serviceId },
    }
  );

  return (result.data ?? []).length > 0;
}

// 1. List all services
server.registerTool(
  "list_services",
  {
    title: "List Services",
    description:
      "List all services in Ripple's FalkorDB graph, including their IDs and criticality.",
    inputSchema: {},
  },
  async () => {
    try {
      const services = await listServices();
      return successResult({ services });
    } catch (error) {
      console.error("list_services failed:", error.message);
      return errorResult(
        "Unable to list services. Please check the graph database connection."
      );
    }
  }
);

// 2. Analyze the impact of a service failure
server.registerTool(
  "analyze_impact",
  {
    title: "Analyze Failure Impact",
    description:
      "Analyze which services are affected if a service fails. Choose maxHops from 1 to 5. Returns affected services and evidence paths from FalkorDB.",
    inputSchema: {
      serviceId: serviceIdSchema,
      maxHops: z.number().int().min(1).max(5).default(2),
    },
  },
  async ({ serviceId, maxHops = 2 }) => {
    try {
      const exists = await serviceExists(serviceId);

      if (!exists) {
        return errorResult(
          `Service "${serviceId}" was not found. Use list_services to check valid service IDs.`
        );
      }

      const result = await analyzeImpact(serviceId, maxHops);

      if (!result) {
        return errorResult(
          `Impact analysis returned no result for "${serviceId}".`
        );
      }

      return successResult(result);
    } catch (error) {
      console.error("analyze_impact failed:", error.message);
      return errorResult(
        `Unable to analyze impact for "${serviceId}". Please check the service ID and graph database.`
      );
    }
  }
);

// 3. Find dependency paths between two services
server.registerTool(
  "get_dependency_path",
  {
    title: "Find Dependency Paths",
    description:
      "Find paths connecting two services through DEPENDS_ON relationships in either traversal direction. Returns service names, hop counts, and relationship types. Traversal direction does not imply that stored relationships point both ways.",
    inputSchema: {
      fromServiceId: serviceIdSchema,
      toServiceId: serviceIdSchema,
    },
  },
  async ({ fromServiceId, toServiceId }) => {
    try {
      const [fromExists, toExists] = await Promise.all([
        serviceExists(fromServiceId),
        serviceExists(toServiceId),
      ]);

      if (!fromExists) {
        return errorResult(
          `Source service "${fromServiceId}" was not found. Use list_services to check valid service IDs.`
        );
      }

      if (!toExists) {
        return errorResult(
          `Destination service "${toServiceId}" was not found. Use list_services to check valid service IDs.`
        );
      }

      const result = await graph.query(
        `
        MATCH p=(a:Service {id: $fromId})-[:DEPENDS_ON*1..5]-
                (b:Service {id: $toId})
        RETURN [n IN nodes(p) | n.name] AS path,
               length(p) AS hops,
               [r IN relationships(p) | type(r)] AS relationships
        ORDER BY hops
        LIMIT 5
        `,
        {
          params: {
            fromId: fromServiceId,
            toId: toServiceId,
          },
        }
      );

      return successResult({
        fromServiceId,
        toServiceId,
        traversal: "either direction",
        paths: result.data ?? [],
        message:
          (result.data ?? []).length > 0
            ? "Paths found. Check stored relationship directions before interpreting failure propagation."
            : "No connecting paths found within 5 hops in either traversal direction.",
      });
    } catch (error) {
      console.error("get_dependency_path failed:", error.message);
      return errorResult(
        "Unable to find dependency paths. Please check the graph database and service IDs."
      );
    }
  }
);

// 4. Find related workflows
server.registerTool(
  "get_workflows",
  {
    title: "Find Related Workflows",
    description:
      "List workflows and the services they require. Optionally filter by service IDs to identify potentially affected workflows.",
    inputSchema: {
      serviceIds: z.array(serviceIdSchema).max(50).optional(),
    },
  },
  async ({ serviceIds }) => {
    try {
      if (serviceIds?.length) {
        const checks = await Promise.all(
          serviceIds.map(async (serviceId) => ({
            serviceId,
            exists: await serviceExists(serviceId),
          }))
        );

        const unknownIds = checks
          .filter((item) => !item.exists)
          .map((item) => item.serviceId);

        if (unknownIds.length) {
          return errorResult(
            `Unknown service ID(s): ${unknownIds.join(", ")}. Use list_services to check valid service IDs.`
          );
        }
      }

      const result = await graph.query(
        `
        MATCH (w:Workflow)-[:REQUIRES]->(s:Service)
        WITH w, collect(DISTINCT {
          id: s.id,
          name: s.name
        }) AS services
        WHERE $filterEnabled = false
           OR any(svc IN services WHERE svc.id IN $serviceIds)
        RETURN w.id AS id,
               w.name AS name,
               services
        ORDER BY name
        `,
        {
          params: {
            filterEnabled: Boolean(serviceIds?.length),
            serviceIds: serviceIds ?? [],
          },
        }
      );

      return successResult({
        workflows: result.data ?? [],
      });
    } catch (error) {
      console.error("get_workflows failed:", error.message);
      return errorResult(
        "Unable to retrieve workflows. Please check the graph database connection."
      );
    }
  }
);

// 5. Summarize graph nodes and relationships
server.registerTool(
  "get_graph_summary",
  {
    title: "Summarize Graph",
    description:
      "Return counts of nodes by label and relationships by type in the Ripple FalkorDB graph.",
    inputSchema: {},
  },
  async () => {
    try {
      const [nodesResult, edgesResult] = await Promise.all([
        graph.query(`
          MATCH (n)
          UNWIND labels(n) AS label
          RETURN label, count(*) AS count
          ORDER BY label
        `),
        graph.query(`
          MATCH ()-[r]->()
          RETURN type(r) AS relationshipType, count(*) AS count
          ORDER BY relationshipType
        `),
      ]);

      return successResult({
        nodesByLabel: nodesResult.data ?? [],
        relationshipsByType: edgesResult.data ?? [],
      });
    } catch (error) {
      console.error("get_graph_summary failed:", error.message);
      return errorResult(
        "Unable to summarize the graph. Please check the graph database connection."
      );
    }
  }
);

// 6. Calculate degree centrality of services
server.registerTool(
  "get_centrality",
  {
    title: "Get Degree Centrality",
    description:
      "Calculate degree centrality (in-degree direct dependents and out-degree dependencies) for services in the graph to identify critical infrastructure hubs.",
    inputSchema: {
      serviceId: serviceIdSchema.optional(),
    },
  },
  async ({ serviceId } = {}) => {
    try {
      if (serviceId) {
        const exists = await serviceExists(serviceId);

        if (!exists) {
          return errorResult(
            `Service "${serviceId}" was not found. Use list_services to check valid service IDs.`
          );
        }
      }

      const centrality = await getDegreeCentrality(serviceId || null);
      return successResult({ centrality });
    } catch (error) {
      console.error("get_centrality failed:", error.message);
      return errorResult(
        "Unable to calculate degree centrality. Please check the graph database connection."
      );
    }
  }
);

// Start the MCP server over stdio
const transport = new StdioServerTransport();

try {
  await server.connect(transport);
  console.error("Ripple MCP server connected over stdio.");
} catch (error) {
  console.error("Failed to start Ripple MCP server:", error);
  await closeDatabase().catch(() => { });
  process.exitCode = 1;
}
