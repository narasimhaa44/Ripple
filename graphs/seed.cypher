
/* RIPPLE — Seed Data */

/* 1. Services */
MERGE (p:Service {id:'svc-payment'})
SET p.name='Payment Service', p.criticality=5;

MERGE (o:Service {id:'svc-order'})
SET o.name='Order Service', o.criticality=5;

MERGE (i:Service {id:'svc-inventory'})
SET i.name='Inventory Service', i.criticality=4;

MERGE (n:Service {id:'svc-notification'})
SET n.name='Notification Service', n.criticality=2;

MERGE (a:Service {id:'svc-auth'})
SET a.name='Authentication Service', a.criticality=5;

MERGE (c:Service {id:'svc-catalog'})
SET c.name='Product Catalog Service', c.criticality=3;

MERGE (s:Service {id:'svc-shipping'})
SET s.name='Shipping Service', s.criticality=4;

MERGE (an:Service {id:'svc-analytics'})
SET an.name='Analytics Service', an.criticality=2;

/* 2. Databases */
MERGE (d1:Database {id:'db-orders'})
SET d1.name='Orders Database';

MERGE (d2:Database {id:'db-payments'})
SET d2.name='Payments Database';

MERGE (d3:Database {id:'db-inventory'})
SET d3.name='Inventory Database';

/* 3. APIs */
MERGE (api1:API {id:'api-payment'})
SET api1.name='Payment API';

MERGE (api2:API {id:'api-order'})
SET api2.name='Order API';

/* 4. Business workflows */
MERGE (w1:Workflow {id:'wf-checkout'})
SET w1.name='Customer Checkout', w1.criticality=5;

MERGE (w2:Workflow {id:'wf-fulfillment'})
SET w2.name='Order Fulfillment', w2.criticality=4;

MERGE (w3:Workflow {id:'wf-alerts'})
SET w3.name='Customer Notifications', w3.criticality=2;

/* 5. Teams */
MERGE (t1:Team {id:'team-commerce'})
SET t1.name='Commerce Team';

MERGE (t2:Team {id:'team-platform'})
SET t2.name='Platform Team';

MERGE (t3:Team {id:'team-ops'})
SET t3.name='Operations Team';

/* 6. Queue and external system */
MERGE (q:Queue {id:'queue-events'})
SET q.name='Order Events Queue';

MERGE (e:ExternalSystem {id:'ext-email'})
SET e.name='Email Provider';

/* 7. Service dependencies */
MATCH (o:Service {id:'svc-order'}),
      (p:Service {id:'svc-payment'})
MERGE (o)-[:DEPENDS_ON]->(p);

MATCH (o:Service {id:'svc-order'}),
      (i:Service {id:'svc-inventory'})
MERGE (o)-[:DEPENDS_ON]->(i);

MATCH (n:Service {id:'svc-notification'}),
      (p:Service {id:'svc-payment'})
MERGE (n)-[:DEPENDS_ON]->(p);

MATCH (o:Service {id:'svc-order'}),
      (a:Service {id:'svc-auth'})
MERGE (o)-[:DEPENDS_ON]->(a);

MATCH (o:Service {id:'svc-order'}),
      (c:Service {id:'svc-catalog'})
MERGE (o)-[:DEPENDS_ON]->(c);

MATCH (s:Service {id:'svc-shipping'}),
      (o:Service {id:'svc-order'})
MERGE (s)-[:DEPENDS_ON]->(o);

MATCH (an:Service {id:'svc-analytics'}),
      (o:Service {id:'svc-order'})
MERGE (an)-[:DEPENDS_ON]->(o);

/* 8. Database connections */
MATCH (p:Service {id:'svc-payment'}),
      (d:Database {id:'db-payments'})
MERGE (p)-[:READS_FROM]->(d);

MATCH (o:Service {id:'svc-order'}),
      (d:Database {id:'db-orders'})
MERGE (o)-[:READS_FROM]->(d);

MATCH (i:Service {id:'svc-inventory'}),
      (d:Database {id:'db-inventory'})
MERGE (i)-[:READS_FROM]->(d);

/* 9. API calls */
MATCH (o:Service {id:'svc-order'}),
      (api:API {id:'api-payment'})
MERGE (o)-[:CALLS]->(api);

MATCH (o:Service {id:'svc-order'}),
      (api:API {id:'api-order'})
MERGE (o)-[:CALLS]->(api);

/* 10. Workflow dependencies */
MATCH (w:Workflow {id:'wf-checkout'}),
      (p:Service {id:'svc-payment'})
MERGE (w)-[:REQUIRES]->(p);

MATCH (w:Workflow {id:'wf-checkout'}),
      (o:Service {id:'svc-order'})
MERGE (w)-[:REQUIRES]->(o);

MATCH (w:Workflow {id:'wf-checkout'}),
      (a:Service {id:'svc-auth'})
MERGE (w)-[:REQUIRES]->(a);

MATCH (w:Workflow {id:'wf-fulfillment'}),
      (o:Service {id:'svc-order'})
MERGE (w)-[:REQUIRES]->(o);

MATCH (w:Workflow {id:'wf-fulfillment'}),
      (i:Service {id:'svc-inventory'})
MERGE (w)-[:REQUIRES]->(i);

MATCH (w:Workflow {id:'wf-alerts'}),
      (n:Service {id:'svc-notification'})
MERGE (w)-[:REQUIRES]->(n);

/* 11. Team ownership */
MATCH (t:Team {id:'team-commerce'}),
      (o:Service {id:'svc-order'})
MERGE (t)-[:OWNS]->(o);

MATCH (t:Team {id:'team-platform'}),
      (p:Service {id:'svc-payment'})
MERGE (t)-[:OWNS]->(p);

MATCH (t:Team {id:'team-platform'}),
      (a:Service {id:'svc-auth'})
MERGE (t)-[:OWNS]->(a);

MATCH (t:Team {id:'team-ops'}),
      (s:Service {id:'svc-shipping'})
MERGE (t)-[:OWNS]->(s);

/* 12. Event publishing and external integration */
MATCH (o:Service {id:'svc-order'}),
      (q:Queue {id:'queue-events'})
MERGE (o)-[:PUBLISHES_TO]->(q);

MATCH (n:Service {id:'svc-notification'}),
      (e:ExternalSystem {id:'ext-email'})
MERGE (n)-[:INTEGRATES_WITH]->(e);
