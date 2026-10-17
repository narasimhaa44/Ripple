
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeImpact } from "../src/services/impactService.js";
import { getDegreeCentrality } from "../src/services/graphTools.js";

test("Payment failure identifies four affected services", async () => {
    const report = await analyzeImpact("svc-payment");

    assert.ok(report);
    assert.equal(report.failedService.id, "svc-payment");
    assert.equal(report.totalAffected, 4);

    const ids = report.affectedServices.map((service) => service.id);

    assert.ok(ids.includes("svc-order"));
    assert.ok(ids.includes("svc-notification"));
    assert.ok(ids.includes("svc-shipping"));
    assert.ok(ids.includes("svc-analytics"));
});

test("Affected services have scores and evidence paths", async () => {
    const report = await analyzeImpact("svc-payment");

    for (const service of report.affectedServices) {
        assert.ok(service.riskScore >= 0 && service.riskScore <= 100);

        assert.ok(
            ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(service.severity)
        );

        assert.ok(service.evidencePath.length >= 2);

        assert.equal(
            service.evidencePath.at(-1),
            report.failedService.name
        );
    }

    for (let i = 1; i < report.affectedServices.length; i++) {
        assert.ok(
            report.affectedServices[i - 1].riskScore >=
            report.affectedServices[i].riskScore
        );
    }
});

test("Inventory failure discovers Order Service", async () => {
    const report = await analyzeImpact("svc-inventory");

    assert.ok(report);

    assert.ok(
        report.affectedServices.some((service) => service.id === "svc-order")
    );
});

test("Unknown service returns null", async () => {
    const report = await analyzeImpact("svc-does-not-exist");

    assert.equal(report, null);
});

test("Invalid empty ID is rejected", async () => {
    await assert.rejects(
        () => analyzeImpact(""),
        { statusCode: 400 }
    );
});

test("A service with no dependents returns an empty impact list", async () => {
    const report = await analyzeImpact("svc-notification");

    assert.ok(report);
    assert.equal(report.totalAffected, 0);
    assert.deepEqual(report.affectedServices, []);
});

test("Recommendations use the actual failed service", async () => {
    const report = await analyzeImpact("svc-inventory");

    const orderRecommendation = report.recommendations.find(
        (recommendation) =>
            recommendation.action.includes("Order Service")
    );

    assert.ok(orderRecommendation, "Expected an Order Service recommendation");

    assert.ok(
        orderRecommendation.action.includes("Inventory Service"),
        "Recommendation should mention the actual failed service"
    );

    assert.ok(
        orderRecommendation.reason.includes("Inventory Service"),
        "Reason should identify the actual failed service"
    );

    assert.ok(
        orderRecommendation.reason.includes("Order Service"),
        "Reason should identify the affected service"
    );

    assert.ok(
        !orderRecommendation.action.toLowerCase().includes("payment"),
        "Inventory failure recommendation should not incorrectly mention payment"
    );
});

test("Configurable maxHops=1 limits discovery to direct dependents only", async () => {
    const report = await analyzeImpact("svc-inventory", 1);

    assert.ok(report);
    assert.equal(report.maxHops, 1);
    assert.equal(report.totalAffected, 1);
    assert.equal(report.affectedServices[0].id, "svc-order");
    assert.equal(report.affectedServices[0].hops, 1);
});

test("Configurable maxHops=2 discovers 1-hop and 2-hop dependents", async () => {
    const report = await analyzeImpact("svc-inventory", 2);

    assert.ok(report);
    assert.equal(report.maxHops, 2);
    assert.equal(report.totalAffected, 3);

    const ids = report.affectedServices.map((s) => s.id);
    assert.ok(ids.includes("svc-order"));
    assert.ok(ids.includes("svc-shipping"));
    assert.ok(ids.includes("svc-analytics"));
});

test("Invalid maxHops values are rejected", async () => {
    await assert.rejects(() => analyzeImpact("svc-inventory", 0), {
        statusCode: 400,
    });
    await assert.rejects(() => analyzeImpact("svc-inventory", 6), {
        statusCode: 400,
    });
    await assert.rejects(() => analyzeImpact("svc-inventory", 2.5), {
        statusCode: 400,
    });
    await assert.rejects(() => analyzeImpact("svc-inventory", "2"), {
        statusCode: 400,
    });
});

test("Degree centrality correctly computes inDegree and outDegree dependencies", async () => {
    const paymentCent = await getDegreeCentrality("svc-payment");
    assert.ok(paymentCent);
    assert.equal(paymentCent.id, "svc-payment");
    assert.equal(paymentCent.inDegree, 2); // Order and Notification depend on Payment
    assert.equal(paymentCent.centralityTier, "CRITICAL_HUB");

    const shippingCent = await getDegreeCentrality("svc-shipping");
    assert.ok(shippingCent);
    assert.equal(shippingCent.inDegree, 0); // Terminal node: no service depends on Shipping
    assert.equal(shippingCent.centralityTier, "LEAF_NODE");

    const allCent = await getDegreeCentrality();
    assert.ok(Array.isArray(allCent));
    assert.ok(allCent.length >= 8);
    // Verified sorted in descending inDegree order
    assert.ok(allCent[0].inDegree >= allCent[allCent.length - 1].inDegree);
});

test("Impact report attaches centrality and auditable explanation objects", async () => {
    const report = await analyzeImpact("svc-payment", 2);
    assert.ok(report);
    assert.ok(typeof report.failedService.inDegree === "number");
    assert.ok(report.failedService.centralityTier);

    for (const service of report.affectedServices) {
        assert.ok(typeof service.inDegree === "number");
        assert.ok(service.centralityTier);
        assert.ok(service.explanation);

        const exp = service.explanation;
        assert.equal(exp.criticality, service.criticality);
        assert.equal(exp.hops, service.hops);
        assert.equal(exp.calculatedScore, service.riskScore);
        assert.equal(exp.severity, service.severity);

        // Verify formula mathematical agreement: round((criticality / 5) * 70 + 30 / hops)
        const expectedScore = Math.max(0, Math.min(100, Math.round(
            (service.criticality / 5) * 70 + 30 / Math.max(1, service.hops)
        )));
        assert.equal(service.riskScore, expectedScore);
        assert.ok(exp.pathDescription.includes(service.name));
        assert.ok(exp.centralityDescription.includes(String(service.inDegree)));
    }
});

test("Centrality influences recommendations and identifies critical dependency hubs", async () => {
    const report = await analyzeImpact("svc-inventory", 2);
    assert.ok(report);

    // Order Service has inDegree = 2 and should trigger centrality alert/recommendation
    const orderService = report.affectedServices.find((s) => s.id === "svc-order");
    assert.ok(orderService);
    assert.equal(orderService.inDegree, 2);

    const orderRec = report.recommendations.find((r) => r.action.includes("Order Service"));
    assert.ok(orderRec);
    assert.ok(orderRec.reason.includes("Centrality alert") || (orderRec.evidenceSource && orderRec.evidenceSource.includes("Centrality")));
});

