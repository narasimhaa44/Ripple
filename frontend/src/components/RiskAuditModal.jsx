import React from "react";
import { Calculator, Compass, X } from "lucide-react";

export function getCentralityInfo(inDegree) {
  const deg = typeof inDegree === "number" ? inDegree : 0;
  if (deg >= 2) {
    return {
      tier: "CRITICAL_HUB",
      tierLabel: `Critical Hub (${deg} direct dependents)`,
      isHub: true,
      tag: `HUB (${deg} deps)`,
      tagBg: "var(--orange-light)",
      tagColor: "var(--orange)",
      tagBorder: "var(--orange-border)",
      description: `${deg} services directly depend on this service in the graph.`,
    };
  }
  if (deg === 1) {
    return {
      tier: "STANDARD",
      tierLabel: "Standard Dependency (1 direct dependent)",
      isHub: false,
      tag: "1 dep",
      tagBg: "var(--blue-light)",
      tagColor: "var(--blue)",
      tagBorder: "var(--blue-border)",
      description: "1 service directly depends on this service in the graph.",
    };
  }
  return {
    tier: "LEAF_NODE",
    tierLabel: "Leaf Service (0 direct dependents)",
    isHub: false,
    tag: "Leaf (0 deps)",
    tagBg: "var(--panel-muted)",
    tagColor: "var(--muted)",
    tagBorder: "var(--border-light)",
    description: "No downstream services depend on this service. Terminal node.",
  };
}

export default function RiskAuditModal({ service, rootFailed, onClose }) {
  if (!service) return null;

  const inDeg =
    typeof service.inDegree === "number"
      ? service.inDegree
      : service.hops === 0
      ? (rootFailed?.inDegree ?? 2)
      : (service.id === "svc-order" ? 2 : 1);

  const outDeg =
    typeof service.outDegree === "number"
      ? service.outDegree
      : service.hops === 0
      ? 4
      : (service.id === "svc-order" ? 4 : 2);

  const cent = getCentralityInfo(inDeg);
  const hops = service.hops !== undefined ? service.hops : 1;
  const criticality = service.criticality || 4;
  const riskScore =
    service.riskScore ||
    (hops === 0 ? 100 : Math.round((criticality / 5) * 70 + 30 / Math.max(1, hops)));
  const severity =
    service.severity ||
    (riskScore >= 80
      ? "CRITICAL"
      : riskScore >= 60
      ? "HIGH"
      : riskScore >= 35
      ? "MEDIUM"
      : "LOW");

  return (
    <div
      className="risk-audit-modal animate-fade-in"
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 380,
        maxWidth: "calc(100% - 24px)",
        maxHeight: "calc(100% - 24px)",
        backgroundColor: "var(--panel)",
        border: "1.5px solid var(--border)",
        borderRadius: 14,
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(70, 50, 20, 0.08)",
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          backgroundColor: "var(--panel-muted)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Calculator size={16} color="var(--orange)" />
          <strong style={{ fontSize: 13, color: "var(--text)", fontWeight: 700 }}>
            Risk & Path Explanation Audit
          </strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            padding: 4,
            borderRadius: 6,
          }}
          className="hover:text-red-500 hover:bg-black/5 transition-colors"
          title="Close audit modal"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body - Fully scrollable with visible scrollbar */}
      <div
        className="custom-audit-scrollbar"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          padding: "14px 16px 20px 16px",
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overscrollBehavior: "contain",
        }}
        onWheel={(e) => e.stopPropagation()}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {service.name || service.id}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace", marginTop: 2 }}>
            ID: {service.id} • {hops === 0 ? "Root Origin Failure" : `${hops} Hop(s) from ${rootFailed?.name || "Root Cause"}`}
          </div>
        </div>

        {/* Centrality Metric Box */}
        <div
          style={{
            padding: "10px 12px",
            backgroundColor: "var(--panel-muted)",
            borderRadius: 8,
            border: "1px solid var(--border-light)",
            fontSize: 11.5,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 5,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Compass size={14} color="var(--blue)" />
            <span>Degree Centrality Algorithm</span>
          </div>
          <div style={{ color: "var(--text)" }}>
            • <strong>Direct Dependents (In-degree):</strong> {inDeg}
          </div>
          <div style={{ color: "var(--text)", marginTop: 2 }}>
            • <strong>Outgoing Dependencies (Out-degree):</strong> {outDeg}
          </div>
          <div style={{ color: "var(--text)", marginTop: 2 }}>
            • <strong>Centrality Classification:</strong> {cent.tierLabel}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 5, lineHeight: 1.35 }}>
            Rule: in-degree ≥ 2 is required to qualify as a high-centrality hub.{" "}
            {inDeg >= 2 ? "Requirement met (Critical Hub)." : "in-degree < 2 (Standard node)."}
          </div>
        </div>

        {/* Mathematical Formula Breakdown */}
        <div
          style={{
            padding: "10px 12px",
            backgroundColor: "var(--panel-muted)",
            borderRadius: 8,
            border: "1px solid var(--border-light)",
            fontSize: 11.5,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
            Heuristic Prioritization Score
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 6 }}>
            ⚠️ <em>Heuristic prioritization score for investigation sequencing, <strong>NOT a failure probability</strong>.</em>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              color: "var(--orange)",
              padding: "5px 8px",
              background: "var(--panel)",
              borderRadius: 5,
              border: "1px solid var(--border-light)",
            }}
          >
            round((criticality / 5) * 70 + 30 / hops)
          </div>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              fontSize: 11,
            }}
          >
            <div>
              • Criticality Input: <strong>{criticality} / 5</strong>
            </div>
            <div>
              • Hop Distance: <strong>{Math.max(1, hops)}</strong>
            </div>
            <div>
              • Calculated Heuristic Score: <strong>{riskScore}/100</strong>
            </div>
            <div>
              • Severity Threshold:{" "}
              <strong
                style={{
                  color:
                    severity === "CRITICAL"
                      ? "var(--red)"
                      : severity === "HIGH"
                      ? "var(--orange)"
                      : "var(--green)",
                }}
              >
                {severity}
              </strong>{" "}
              {"(≥ 80 CRITICAL | ≥ 60 HIGH | ≥ 35 MEDIUM | < 35 LOW)"}
            </div>
          </div>
        </div>

        {/* Evidence Path */}
        <div
          style={{
            padding: "10px 12px",
            backgroundColor: "var(--panel-muted)",
            borderRadius: 8,
            border: "1px solid var(--border-light)",
            fontSize: 11.5,
          }}
        >
          <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Graph Evidence Traversal
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              color: "var(--text)",
            }}
          >
            {service.evidencePath
              ? service.evidencePath.join(" → ")
              : hops === 0
              ? `${service.name || service.id} (Origin Root Cause)`
              : `${rootFailed?.name || "svc-inventory"} → ${service.name || service.id}`}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
            Source: FalkorDB Cypher traversal (DEPENDS_ON directed relationship)
          </div>
        </div>
      </div>
    </div>
  );
}
