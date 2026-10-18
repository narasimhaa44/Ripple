
import test from "node:test";
import assert from "node:assert/strict";
import { graph } from "../src/db.js";

/**
 * Find connecting paths between two services in FalkorDB.
 * Traversal is undirected, so it can find a connection
 * regardless of the stored DEPENDS_ON relationship direction.
 */
async function findDependencyPaths(fromServiceId, toServiceId) {
    const result = await graph.query(
        `
        MATCH p = (a:Service {id: $fromId})-[:DEPENDS_ON*1..5]-
                  (b:Service {id: $toId})
        RETURN
            [n IN nodes(p) | n.name] AS path,
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

    return result.data ?? [];
}

test("Inventory and Analytics have a connecting path", async () => {
    const paths = await findDependencyPaths(
        "svc-inventory",
        "svc-analytics"
    );

    assert.ok(paths.length > 0, "Expected a connecting path");

    const shortestPath = paths[0];

    assert.equal(
        shortestPath.path.length,
        shortestPath.hops + 1,
        "Path node count should equal hops + 1"
    );

    assert.ok(shortestPath.path.includes("Inventory Service"));
    assert.ok(shortestPath.path.includes("Analytics Service"));
    assert.ok(shortestPath.path.includes("Order Service"));
});

test("Payment and Analytics have a connecting path", async () => {
    const paths = await findDependencyPaths(
        "svc-payment",
        "svc-analytics"
    );

    assert.ok(paths.length > 0, "Expected a connecting path");

    const shortestPath = paths[0];

    assert.equal(
        shortestPath.path.length,
        shortestPath.hops + 1,
        "Path node count should equal hops + 1"
    );

    assert.ok(shortestPath.path.includes("Payment Service"));
    assert.ok(shortestPath.path.includes("Analytics Service"));
    assert.ok(shortestPath.path.includes("Order Service"));
});

test("Authentication and Analytics have a connecting path", async () => {
    const paths = await findDependencyPaths(
        "svc-auth",
        "svc-analytics"
    );

    assert.ok(paths.length > 0, "Expected a connecting path");

    const shortestPath = paths[0];

    assert.equal(
        shortestPath.path.length,
        shortestPath.hops + 1,
        "Path node count should equal hops + 1"
    );

    assert.equal(
        shortestPath.path[0],
        "Authentication Service"
    );

    assert.equal(
        shortestPath.path[shortestPath.path.length - 1],
        "Analytics Service"
    );

    assert.ok(shortestPath.path.includes("Order Service"));
    assert.equal(shortestPath.hops, 2);
});
