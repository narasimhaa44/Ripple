
/* RIPPLE — Impact Investigation */

/* A. Inspect the component being investigated */
MATCH (failed:Service {id:'svc-payment'})
RETURN failed.id, failed.name, failed.criticality;

/* B. Find direct and indirect dependent services */
MATCH p=(dependent:Service)-[:DEPENDS_ON*1..5]->
         (failed:Service {id:'svc-payment'})
RETURN
  dependent.id AS affectedServiceId,
  dependent.name AS affectedService,
  dependent.criticality AS criticality,
  length(p) AS dependencyHops,
  [node IN nodes(p) | node.name] AS evidencePath
ORDER BY dependencyHops ASC;

/* C. Find direct dependents */
MATCH (dependent:Service)-[:DEPENDS_ON]->
      (failed:Service {id:'svc-payment'})
RETURN dependent.id, dependent.name;

/* D. Find related databases of impacted services */
MATCH (dependent:Service)-[:DEPENDS_ON*1..5]->
      (:Service {id:'svc-payment'}),
      (dependent)-[:READS_FROM]->(db:Database)
RETURN DISTINCT dependent.name, db.name;
