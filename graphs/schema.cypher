
/*
 RIPPLE — Graph Schema

 Node labels:
   Service, Database, API, Workflow,
   Team, Queue, ExternalSystem, Incident

 Relationship types:
   DEPENDS_ON, READS_FROM, CALLS,
   REQUIRES, OWNS, PUBLISHES_TO,
   INTEGRATES_WITH, AFFECTED

 Direction convention:
   (dependent)-[:DEPENDS_ON]->(dependency)

 Example:
   (Order Service)-[:DEPENDS_ON]->(Payment Service)

 If Payment fails, Order may be affected.
*/

CREATE INDEX FOR (s:Service) ON (s.id);
CREATE INDEX FOR (d:Database) ON (d.id);
CREATE INDEX FOR (a:API) ON (a.id);
CREATE INDEX FOR (w:Workflow) ON (w.id);
CREATE INDEX FOR (t:Team) ON (t.id);
CREATE INDEX FOR (q:Queue) ON (q.id);
CREATE INDEX FOR (e:ExternalSystem) ON (e.id);
CREATE INDEX FOR (i:Incident) ON (i.id);
