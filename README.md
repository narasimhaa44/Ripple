
# RIPPLE — AI What-If Impact Investigator

RIPPLE is a graph-powered AI investigation agent that analyzes how a failure in one microservice could affect other services and business workflows.

Built with FalkorDB, Cypher, Node.js, and the Model Context Protocol (MCP), RIPPLE uses connected dependency data to perform multi-hop reasoning, retrieve evidence paths, identify affected workflows, and explain the basis of its results.

Instead of relying only on isolated records or free-form AI guesses, RIPPLE uses graph queries to ground impact analysis in explicit relationships. An AI agent can discover and invoke graph tools through MCP, while the backend retrieves local incident records to provide additional investigation context.

> **Scope:** RIPPLE is a hackathon prototype that uses a fictional microservices ecosystem and local sample incident records. It is not a live production monitoring system. Graph-derived impacts indicate potential effects, not proof of an actual outage.

---

## Table of Contents

- [Why RIPPLE?](#why-ripple)
- [Track 01 Alignment](#track-01-alignment)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Graph Data Model](#graph-data-model)
- [Graph Queries Used](#graph-queries-used)
- [Graph Algorithms](#graph-algorithms)
- [MCP Integration](#mcp-integration)
- [Agent Investigation Workflow](#agent-investigation-workflow)
- [Risk Scoring](#risk-scoring)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation and Setup](#installation-and-setup)
- [Loading the Graph](#loading-the-graph)
- [Running RIPPLE](#running-ripple)
- [Testing](#testing)
- [Example Investigation](#example-investigation)
- [API and MCP Bridge](#api-and-mcp-bridge)
- [Limitations](#limitations)
- [Future Improvements](#future-improvements)

---

## Why RIPPLE?

Modern applications contain services, databases, APIs, queues, and workflows that depend on one another.

When one service fails, the consequences may propagate through several dependency levels. A direct lookup may reveal one dependency, but it may not reveal the complete chain of potential impact.

RIPPLE models these connections in FalkorDB and uses graph traversal to answer questions such as:

- What could be affected if Inventory Service fails?
- Which services depend on the failed component, directly or indirectly?
- What is the evidence path connecting an affected service to the failed service?
- Which business workflows are associated with the affected components?
- Which services are structurally important in the dependency graph?
- What local incident records might help an engineer investigate the failure?

The objective is to make an agent's investigation more contextual, traceable, and explainable.

---

## Track 01 Alignment

RIPPLE is designed for the **Agents That Act on Connected Data** track.

| Track focus | RIPPLE implementation |
|---|---|
| Multi-hop reasoning | Traverses dependency relationships across configurable hop limits |
| Graph queries and algorithms as agent tools | Exposes impact analysis, dependency paths, graph summaries, and centrality through MCP tools |
| Tool selection through MCP | The agent can discover and invoke available MCP tools |
| Actions based on graph evidence | Produces affected-service lists, workflow context, risk prioritization, and investigation recommendations |
| Explainable results | Returns dependency paths, hop counts, supporting records, and tool traces |

The graph is an active part of the investigation workflow: its relationships determine which services are considered potentially affected.

---

## Features

- **What-if failure analysis:** Investigate the potential impact of a selected service failure.
- **Multi-hop dependency traversal:** Explore affected services within a configurable hop limit.
- **Evidence paths:** Show the dependency chain connecting affected services to the failed component.
- **Workflow analysis:** Identify modeled business workflows associated with affected services.
- **Centrality analysis:** Identify structurally important services using dependency relationships.
- **MCP tool discovery:** Expose graph capabilities as tools an AI agent can discover and call.
- **AI-assisted investigation:** Use Groq for tool selection and evidence-based explanations when configured.
- **Incident context:** Retrieve local sample timelines, logs, deployment details, and root-cause hypotheses.
- **Tool execution traces:** Show which tools were invoked and distinguish graph analysis from local incident lookup.
- **Fallback behavior:** Continue with backend-generated graph results when the Groq API is unavailable, provided the graph database and backend are operational.
- **Heuristic risk prioritization:** Help organize investigation results without presenting scores as probabilities of failure.

---

## Architecture

```text
                        User
                         |
                         v
                  React Frontend
                         |
                         v
                 Node.js / Express
                         |
                 Agent Orchestration
                         |
                +--------+---------+
                |                  |
                v                  v
           Groq API             MCP Client
          (optional)                |
                                    | stdio
                                    v
                                MCP Server
                                    |
                                    v
                                 FalkorDB
                                    |
                         Cypher Queries / Traversals
                                    |
                                    v
                        Impact and Evidence Paths

                  Local Incident Service
                           |
                           v
                  Investigation Context
```

### Component responsibilities

**React frontend**
- Accepts investigation questions.
- Displays affected services, hop counts, workflows, and evidence paths.
- Presents tool traces and investigation recommendations.

**Express backend**
- Receives user questions and coordinates investigation requests.
- Connects the agent, graph services, and local incident service.
- Returns structured investigation results to the frontend.

**MCP client and server**
- Discover and expose graph tools.
- Invoke graph operations through the MCP stdio transport.
- Return tool results to the backend.

**FalkorDB**
- Stores the service dependency graph.
- Executes Cypher queries for graph traversal and relationship analysis.

**Local incident service**
- Supplies predefined incident records.
- Provides timestamps, sample logs, deployment context, and root-cause hypotheses.
- Does not connect to live production monitoring systems.

**Groq API**
- Supports AI-assisted tool selection and explanations when configured.
- Is not the source of truth for dependency paths; the graph analysis supplies those paths.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Graph database | FalkorDB |
| Query language | Cypher |
| Graph client | FalkorDB JavaScript client |
| Agent model provider | Groq API |
| Agent tool protocol | Model Context Protocol (MCP) |
| Input validation | Zod |
| Containerization | Docker, Docker Compose |
| Automated tests | Node.js test runner |

---

## Graph Data Model

RIPPLE models a fictional microservices ecosystem as a property graph.

### Node labels

| Label | Description |
|---|---|
| `Service` | Application microservices |
| `Database` | Data stores |
| `API` | Service APIs |
| `Workflow` | Business workflows |
| `Team` | Responsible engineering teams |
| `Queue` | Messaging queues |
| `ExternalSystem` | External dependencies |

### Relationship types

- `DEPENDS_ON`
- `READS_FROM`
- `CALLS`
- `REQUIRES`
- `OWNS`
- `PUBLISHES_TO`
- `INTEGRATES_WITH`

### Dependency direction

A dependency relationship is represented as:

```cypher
(dependent)-[:DEPENDS_ON]->(dependency)
```

For example:

```text
Order Service ──DEPENDS_ON──> Inventory Service
```

This means Order Service depends on Inventory Service.

When Inventory Service is considered failed, Order Service is a potential direct impact candidate. The impact analysis therefore traverses the incoming `DEPENDS_ON` relationships from the failed service to discover its dependents.

### Sample graph

The documented seed dataset contains:

- **21 nodes**
- **24 relationships**

The actual graph contents depend on the seed data loaded into FalkorDB.

---

## Graph Queries Used

The following queries illustrate the principal graph operations used by RIPPLE. They are written for the documented graph model and may need minor adjustments to match the exact labels, properties, relationship patterns, and query files in the repository.

### 1. List all services

**Purpose:** Discover valid services before analyzing a failure.

```cypher
MATCH (s:Service)
RETURN s.id AS serviceId, s.name AS serviceName
ORDER BY serviceName;
```

**Why it matters:** Service discovery helps the agent identify valid targets and handle unknown service names without inventing graph results.

### 2. Direct dependents of a failed service

**Purpose:** Find services that directly depend on the selected service.

```cypher
MATCH (dependent:Service)-[:DEPENDS_ON]->(failed:Service {id: $serviceId})
RETURN
    dependent.id AS serviceId,
    dependent.name AS serviceName,
    failed.name AS failedService,
    1 AS hops
ORDER BY serviceName;
```

**Why it matters:** This identifies the first level of potential impact.

### 3. Multi-hop impact analysis

**Purpose:** Traverse incoming dependency relationships to find direct and indirect dependents.

```cypher
MATCH p = (dependent:Service)-[:DEPENDS_ON*1..5]->(failed:Service {id: $serviceId})
WITH
    dependent,
    failed,
    p,
    length(p) AS hops
WHERE hops <= $maxHops
RETURN
    dependent.id AS serviceId,
    dependent.name AS serviceName,
    failed.id AS failedServiceId,
    failed.name AS failedService,
    hops,
    [n IN nodes(p) | n.name] AS evidencePath
ORDER BY hops ASC, serviceName ASC;
```

**Why it matters:** Multi-hop traversal lets the agent reason about potential downstream effects beyond a single dependency edge.

The path returned by this query follows the dependency direction from the affected dependent toward the failed service. For example:

```text
Shipping Service → Order Service → Inventory Service
```

Here, Shipping Service is two hops from Inventory Service through Order Service.

> The example query uses a maximum traversal depth of five and then filters by `$maxHops`. The actual implementation should enforce a valid hop limit and use the same path orientation as the application's impact service.

### 4. Find a dependency path

**Purpose:** Retrieve an explanation path between a service and the failed service.

```cypher
MATCH p = (dependent:Service)-[:DEPENDS_ON*1..5]->(failed:Service {id: $serviceId})
WHERE dependent.id = $dependentId
  AND length(p) <= $maxHops
RETURN
    [n IN nodes(p) | n.name] AS evidencePath,
    length(p) AS hops
ORDER BY hops ASC
LIMIT 1;
```

**Why it matters:** The path explains why a service appears in the impact report instead of presenting only a list of names.

This query illustrates a shortest-by-hop result for the bounded traversal shown. For larger graphs or multiple relationship types, the exact path strategy should match the application's requirements.

### 5. Identify impacted workflows

**Purpose:** Find workflows associated with services that may be affected by a failure.

One possible graph pattern is:

```cypher
MATCH (w:Workflow)-[:REQUIRES]->(s:Service)
WHERE s.id IN $affectedServiceIds
RETURN DISTINCT
    w.id AS workflowId,
    w.name AS workflowName;
```

**Important:** This example assumes that workflows point to services through `REQUIRES`. If your seed data uses the opposite direction or a different relationship, adjust the pattern to match `graphs/seed.cypher` and the actual graph.

**Why it matters:** Service-level impact can be translated into business context, such as Customer Checkout or Order Fulfillment.

### 6. Look up service ownership

**Purpose:** Identify the engineering team associated with a service.

```cypher
MATCH (t:Team)-[:OWNS]->(s:Service {id: $serviceId})
RETURN
    t.id AS teamId,
    t.name AS teamName,
    s.name AS serviceName;
```

**Why it matters:** Ownership context can help an engineer decide whom to contact during an investigation. Confirm the relationship direction in the actual graph before using this query.

### 7. Summarize the graph

**Purpose:** Count nodes and relationships in the modeled ecosystem.

```cypher
MATCH (n)
WITH count(n) AS nodeCount
MATCH ()-[r]->()
RETURN
    nodeCount,
    count(r) AS relationshipCount;
```

**Why it matters:** Graph summaries help validate whether the expected dataset has been loaded.

**Note:** The precise syntax and behavior of variable scope should be checked against the Cypher version supported by the deployed FalkorDB instance. The repository's working query should be treated as authoritative.

---

## Graph Algorithms

RIPPLE uses graph traversal and centrality information to support investigation.

### Multi-hop traversal

Dependency traversal follows the graph's explicit relationships to find services that depend on a failed component.

The hop count represents the number of dependency edges in an evidence path.

### Degree centrality

The project calculates degree-based centrality to estimate a service's structural importance in the dependency graph.

For the documented relationship direction:

- **In-degree:** Number of direct dependents pointing to the service through `DEPENDS_ON`.
- **Out-degree:** Number of dependencies the service points to.

A service with many direct dependents may deserve higher investigation priority because more services are directly connected to it.

RIPPLE uses a simple threshold to classify services based on their direct dependent count. This is a project-specific heuristic, not a universal definition of criticality.

### Shortest dependency path

The system can report a shortest-by-hop evidence path when multiple paths exist, subject to the query and traversal limits.

### Heuristic risk scoring

The impact service calculates a score using service criticality and hop distance. The resulting value is intended to help prioritize investigation, not to estimate a statistically calibrated failure probability.

**Algorithm limitation:** The documented implementation uses traversal and degree-based centrality. PageRank, community detection, connected components, and other advanced graph algorithms should only be claimed as implemented if corresponding code and tests exist in the repository.

---

## MCP Integration

RIPPLE exposes graph capabilities through the Model Context Protocol.

### Available MCP tools

| Tool | Purpose |
|---|---|
| `list_services` | Discover services in the graph |
| `analyze_impact` | Calculate potential impact within a hop limit |
| `get_dependency_path` | Retrieve dependency path information |
| `get_workflows` | Retrieve workflow information |
| `get_graph_summary` | Summarize graph contents |
| `get_centrality` | Retrieve degree-centrality information |

### Tool selection and execution

The typical flow is:

1. The agent receives a user question.
2. The agent discovers the available MCP tool definitions.
3. The agent selects a suitable graph operation when needed.
4. The MCP client invokes the tool through stdio.
5. The MCP server runs the graph operation.
6. FalkorDB returns structured graph results.
7. The backend passes the results to the agent for explanation.
8. The frontend displays the results and actual tool traces.

The local incident lookup is a separate backend capability and is not represented as a graph query or live monitoring integration.

### Why MCP matters

MCP provides a standard interface for exposing tools to an AI agent. Instead of hardcoding every graph operation into the language-model prompt, the agent can discover tool descriptions and input schemas and call relevant operations.

The tool results ground the investigation in graph data, while the backend and frontend preserve the supporting paths and tool traces.

---

## Agent Investigation Workflow

A typical investigation follows this sequence:

1. **Understand the question:** Identify the target service and requested hop limit.
2. **Validate the target:** Use service discovery to establish whether the service exists.
3. **Retrieve graph evidence:** Invoke the impact-analysis tool through MCP.
4. **Retrieve incident context:** Look up any matching local incident record.
5. **Analyze affected workflows:** Use the graph results to identify related workflows.
6. **Explain the evidence:** Present services, hop counts, dependency paths, and limitations.
7. **Recommend investigation steps:** Suggest checks based on the retrieved evidence.
8. **Show tool traces:** Let the user inspect which tools were invoked and which data sources were used.

The backend's graph results are authoritative for modeled dependency paths. The AI should not reverse relationship directions, fabricate graph nodes, or treat a root-cause hypothesis as a confirmed finding.

---

## Risk Scoring

RIPPLE uses heuristic prioritization scores to help organize potentially affected services.

These scores are based on modeled service criticality and dependency distance. They are not probabilities, confidence intervals, or predictions that a service will fail.

The interface should label them as **Heuristic Prioritization Scores (0–100)**.

A high score means that the service is prioritized for investigation under the current heuristic. It does not prove that the service is unhealthy or will fail.

---

## Repository Structure

The repository contains the main project components below. Check the actual directory contents before assuming every illustrative path exists.

```text
Track1_Ripple/
├── frontend/                  # React frontend
├── graphs/                    # Graph schema, seed data, queries
├── scripts/                   # Seed loader and utility scripts
├── src/
│   ├── services/
│   │   ├── impactService.js   # Impact analysis
│   │   ├── incidentService.js # Local incident records
│   │   └── mcpClient.js       # MCP client
│   ├── mcpServer.js           # MCP server and tools
│   └── server.js              # Express backend
├── tests/                     # Automated tests
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

The graph directory may contain files such as:

```text
graphs/
├── schema.cypher
├── seed.cypher
└── queries/
    ├── impact.cypher
    └── workflows.cypher
```

Keep the README aligned with the files actually committed to GitHub.

---

## Prerequisites

Install:

- Git
- Node.js and npm
- Docker Desktop
- A Groq API key for AI-assisted responses

Docker must be running before starting FalkorDB.

A Groq key is optional if the backend supports the documented fallback path. Graph-based analysis still requires the backend and FalkorDB to be operational.

---

## Environment Configuration

Create a `.env` file in the repository root based on `.env.example`.

Example:

```dotenv
GROQ_API_KEY=your_groq_api_key
```

Use the exact environment variable names required by your implementation. If the graph host or port is configurable, document those variables too.

Never commit `.env` or a real API key. Keep `.env.example` free of secrets.

---

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd YOUR_REPOSITORY_DIRECTORY
```

Replace the placeholders with your repository URL and actual directory name.

### 2. Install backend dependencies

From the repository root:

```bash
npm install
```

### 3. Install frontend dependencies

If the frontend has its own `package.json`:

```bash
cd frontend
npm install
cd ..
```

### 4. Start Docker Desktop

Make sure Docker Desktop is running.

### 5. Start FalkorDB

```bash
docker compose up -d
```

Verify the container:

```bash
docker ps
```

The project's Compose configuration publishes ports `6379` and `3000`.

### External volume setup

If the Compose file uses an external volume named `falkordb_data`, create it on a fresh machine before starting the stack:

```bash
docker volume create falkordb_data
docker compose up -d
```

The volume is not stored in Git. Use the seed loader to populate the graph on a new installation.

---

## Loading the Graph

Once FalkorDB is running, execute the seed loader from the repository root:

```bash
node scripts/loadSeed.js
```

The loader uses `MERGE` to avoid duplicating matching nodes and relationships when seed data is loaded repeatedly.

Verify the graph using the project's graph summary or service listing functionality.

The graph client must connect to the same FalkorDB instance that the backend uses.

---

## Running RIPPLE

Use separate terminals from the repository root.

### Terminal 1 — FalkorDB

```bash
docker compose up -d
```

### Terminal 2 — Backend

```bash
node src/server.js
```

### Terminal 3 — Frontend

For a standard Vite frontend:

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite.

Verify the actual scripts and ports in the current `package.json` files before submitting.

---

## Testing

Run the configured test suite:

```bash
npm test
```

Additional test scripts can be run directly if they exist in the repository. For example:

```bash
node test-mcp.js
node test-centrality.js
node test-invalid-mcp.js
```

### Recommended test scenarios

1. List services through MCP.
2. Analyze direct dependencies.
3. Analyze impact within two hops.
4. Verify the evidence path orientation.
5. Confirm affected workflows are retrieved correctly.
6. Test centrality for services with multiple direct dependents.
7. Query an unknown service and ensure no graph evidence is fabricated.
8. Disable Groq temporarily and verify fallback behavior.
9. Restart the database container and verify that persisted graph data remains available.
10. Confirm incident data is labeled as local records rather than live telemetry.

---

## Example Investigation

Question:

> What is the impact of an Inventory Service failure within 2 hops? Explain the affected services and evidence paths.

For the documented sample graph, the expected affected services are:

| Service | Hops | Interpretation |
|---|---:|---|
| Order Service | 1 | Direct dependent |
| Shipping Service | 2 | Potential indirect impact |
| Analytics Service | 2 | Potential indirect impact |

Illustrative evidence paths:

```text
Order Service → Inventory Service

Shipping Service → Order Service → Inventory Service

Analytics Service → Order Service → Inventory Service
```

The report can also include affected business workflows, heuristic scores, recommendations, local incident context, and MCP tool traces.

These paths establish modeled dependencies, not proof that an actual outage occurred.

### Incident context

The local sample record for Inventory Service includes:

- Recorded failure start: 10:14 AM UTC
- Recorded detection time: 10:21 AM UTC
- A deployment identified as `v2.14.0`
- A connection-pool configuration change
- Sample connection-pool exhaustion and HTTP 503 log entries
- A root-cause hypothesis involving the connection-pool change

The cause remains a hypothesis, and the record is not independently verified live telemetry. The recovery time is not recorded.

---

## API and MCP Bridge

The backend provides application routes for the frontend and an HTTP bridge for MCP operations.

The current documented bridge routes are:

```text
GET  /api/mcp/tools
POST /api/mcp
```

Example tool-list request:

```json
{
  "method": "tools/list"
}
```

Example tool-call request:

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_services",
    "arguments": {}
  }
}
```

The precise response envelope depends on the backend implementation.

The HTTP bridge is an application-level route that forwards operations to the MCP client. It should not be described as the full Streamable HTTP MCP transport unless that transport has been implemented.

---

## Troubleshooting

### FalkorDB is not running

```bash
docker ps
docker logs ripple-falkordb
```

Verify Docker Desktop is running and port `6379` is available.

### The graph is empty

Run:

```bash
node scripts/loadSeed.js
```

Then verify the database and graph name used by the loader and backend.

### MCP tools cannot be discovered

Check that the backend can start the MCP server through the Node.js runtime. Review the backend terminal for startup or connection errors.

### Groq responses are unavailable

Verify the API key and provider configuration. The graph-based fallback requires FalkorDB and the backend to remain operational.

### The frontend cannot reach the backend

Check the frontend API base URL, backend port, and CORS configuration.

### Graph data disappears after a restart

Verify the configured volume is mounted correctly. Do not delete a volume containing data you want to preserve.

---

## Limitations

- The ecosystem is fictional and designed for a hackathon demonstration.
- Incident records are local sample data, not live telemetry.
- Root-cause explanations remain hypotheses unless independently verified.
- Dependency paths describe modeled relationships, not confirmed runtime failures.
- Risk scores are heuristic prioritization estimates, not calibrated failure probabilities.
- The current graph may not model runtime traffic, service redundancy, failover, retries, circuit breakers, or dynamic infrastructure changes.
- Results depend on the quality and completeness of the graph.
- AI-generated explanations depend on the configured model provider.
- Graph queries and algorithm coverage are limited to the operations implemented in the source code.

---

## Future Improvements

- Integrate live observability and health-check sources.
- Synchronize dependency data with real service registries.
- Model failover, retries, circuit breakers, and redundancy.
- Add temporal reasoning over deployments and incidents.
- Add authenticated multi-user access and tenant isolation.
- Expand automated tests and continuous integration.
- Add reproducible deployment and demo environments.

---

## Project Goal

RIPPLE demonstrates how graph databases and MCP-enabled agents can use connected data to perform multi-hop reasoning, retrieve evidence paths, and produce explainable what-if impact investigations.
