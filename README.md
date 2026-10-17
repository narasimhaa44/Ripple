# Ripple — Graph/Data Layer

## Overview
Ripple uses FalkorDB to represent a fictional microservices ecosystem and investigate the potential impact of component failures.

## Technology
- FalkorDB graph database
- Cypher query language
- Node.js and the FalkorDB JavaScript client for loading seed data

## Graph Model

### Node labels
- `Service` — application services
- `Database` — data stores
- `API` — service APIs
- `Workflow` — business workflows
- `Team` — responsible engineering teams
- `Queue` — messaging queues
- `ExternalSystem` — external dependencies

### Relationship types
- `DEPENDS_ON`
- `READS_FROM`
- `CALLS`
- `REQUIRES`
- `OWNS`
- `PUBLISHES_TO`
- `INTEGRATES_WITH`

## Relationship Direction
`(dependent)-[:DEPENDS_ON]->(dependency)`

For example, Order Service depends on Payment Service. If Payment Service fails, Order Service may be affected.

## Current Dataset
- Nodes: 21
- Relationships: 24

## Project Files
- `schema.cypher` — graph model conventions and indexes
- `seed.cypher` — sample nodes and relationships
- `queries/impact.cypher` — dependency impact and evidence paths
- `queries/workflows.cypher` — workflow and team impact queries
- `../scripts/loadSeed.js` — Node.js seed loader

## Load the Seed Data
Start Docker Desktop and ensure the `ripple-falkordb` container is running.

From the `Track1_Ripple` directory, run:

`node scripts/loadSeed.js`

The seed uses `MERGE` to avoid duplicating existing nodes and relationships.

## Validation
The graph has been tested for:
- Direct dependency traversal
- Multi-hop dependency traversal
- Evidence paths
- Affected business workflows
- Team ownership lookup
- A second failure scenario involving Inventory Service

## Limitations
Impact results represent potential effects inferred from the dependency graph. They do not prove a real production outage or account for runtime health, traffic, redundancy, or failover unless that information is added to the graph.
