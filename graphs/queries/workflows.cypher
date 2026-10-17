
/* RIPPLE — Workflow and Ownership Analysis */

/* A. Workflows directly requiring Payment Service */
MATCH (w:Workflow)-[:REQUIRES]->
      (:Service {id:'svc-payment'})
RETURN w.id, w.name, w.criticality;

/* B. Workflows affected through dependent services */
MATCH (w:Workflow)-[:REQUIRES]->(dependent:Service)
      -[:DEPENDS_ON*1..5]->
      (:Service {id:'svc-payment'})
RETURN DISTINCT
  w.id AS workflowId,
  w.name AS affectedWorkflow,
  dependent.name AS dependentService;

/* C. Team responsible for Payment Service */
MATCH (t:Team)-[:OWNS]->
      (:Service {id:'svc-payment'})
RETURN t.id, t.name;

/* D. Find teams owning affected services */
MATCH (t:Team)-[:OWNS]->(dependent:Service)
      -[:DEPENDS_ON*1..5]->
      (:Service {id:'svc-payment'})
RETURN DISTINCT
  t.name AS responsibleTeam,
  dependent.name AS affectedService;
