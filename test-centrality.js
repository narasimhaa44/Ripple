import { graph, closeDatabase } from "./src/db.js";

async function main() {
  const res = await graph.query(`
    MATCH (s:Service)
    OPTIONAL MATCH (dependent:Service)-[:DEPENDS_ON]->(s)
    OPTIONAL MATCH (s)-[:DEPENDS_ON]->(dependency:Service)
    RETURN s.id AS id,
           s.name AS name,
           count(DISTINCT dependent) AS inDegree,
           count(DISTINCT dependency) AS outDegree
    ORDER BY inDegree DESC
  `);
  console.log("Service Degree Centrality:");
  console.table(res.data);
  await closeDatabase();
}

main().catch(console.error);
