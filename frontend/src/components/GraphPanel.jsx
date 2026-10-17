import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Database,
  Maximize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Shield,
  CreditCard,
  Package,
  ShoppingCart,
  Truck,
  Bell,
  BarChart2,
  Layers,
  Globe,
  GitBranch,
  Users,
  Server,
  Activity,
  Info,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calculator,
} from "lucide-react";
import RiskAuditModal from "./RiskAuditModal";


// Spacious, non-congested tiered layout (Layered pipeline from left to right)
const DEFAULT_NODE_POSITIONS = {
  // Column 1 (x: 40): Ingress, APIs, Auth & Entrypoints
  "svc-auth":         { x: 40,   y: 40  },
  "api-payment":      { x: 40,   y: 230 },
  "api-order":        { x: 40,   y: 420 },
  "wf-checkout":      { x: 40,   y: 610 },

  // Column 2 (x: 380): Central Hub & Orchestration
  "svc-order":        { x: 380,  y: 230 },
  "wf-fulfillment":   { x: 380,  y: 40  },
  "team-commerce":    { x: 380,  y: 420 },
  "team-platform":    { x: 380,  y: 610 },

  // Column 3 (x: 720): Core Domain Services
  "svc-inventory":    { x: 720,  y: 40  },
  "svc-payment":      { x: 720,  y: 230 },
  "svc-catalog":      { x: 720,  y: 420 },
  "svc-shipping":     { x: 720,  y: 610 },

  // Column 4 (x: 1060): Databases & Messaging Storage
  "db-inventory":     { x: 1060, y: 40  },
  "db-payments":      { x: 1060, y: 230 },
  "db-orders":        { x: 1060, y: 420 },
  "queue-events":     { x: 1060, y: 610 },

  // Column 5 (x: 1400): Downstream, Analytics & External Integrations
  "svc-notification": { x: 1400, y: 40  },
  "ext-email":        { x: 1400, y: 230 },
  "svc-analytics":    { x: 1400, y: 420 },
  "wf-alerts":        { x: 1400, y: 610 },
  "team-ops":         { x: 1400, y: 800 },
};

const CARD_WIDTH = 224;
const CARD_HEIGHT = 158;

function getNodeDisplayName(node) {
  if (node.id === "svc-auth") return "Auth Service";
  if (node.id === "svc-catalog") return "Catalog Service";
  if (node.id === "db-inventory") return "Inventory DB";
  if (node.id === "db-orders") return "Orders DB";
  if (node.id === "db-payments") return "Payments DB";
  if (node.id === "queue-events") return "Inventory Queue";
  if (node.id === "svc-inventory") return "Inventory Service";
  if (node.id === "svc-order") return "Order Service";
  if (node.id === "svc-payment") return "Payment Service";
  if (node.id === "svc-shipping") return "Shipping Service";
  if (node.id === "svc-analytics") return "Analytics Service";
  if (node.id === "svc-notification") return "Notification Service";
  return node.name || node.label || node.id;
}

function getNodeCategory(node) {
  const type = node.type || "Service";
  const id = node.id || "";
  if (type === "Database" || id.startsWith("db-")) return "POSTGRES";
  if (type === "Queue" || id.startsWith("queue-")) return "KAFKA";
  if (type === "ExternalSystem" || id.startsWith("ext-")) return "GATEWAY";
  if (type === "API" || id.startsWith("api-")) return "REST ENDPOINT";
  if (type === "Workflow" || id.startsWith("wf-")) return "DAG WORKFLOW";
  if (type === "Team" || id.startsWith("team-")) return "OWNERSHIP";
  return "DEPLOYMENT";
}

function getNodeIcon(node) {
  const type = node.type || "Service";
  const id = node.id || "";

  if (type === "Database" || id.startsWith("db-")) return <Database size={13} />;
  if (type === "Queue" || id.startsWith("queue-")) return <Layers size={13} />;
  if (type === "ExternalSystem" || id.startsWith("ext-")) return <Globe size={13} />;
  if (type === "API" || id.startsWith("api-")) return <Server size={13} />;
  if (type === "Workflow" || id.startsWith("wf-")) return <GitBranch size={13} />;
  if (type === "Team" || id.startsWith("team-")) return <Users size={13} />;

  if (id.includes("auth")) return <Shield size={13} />;
  if (id.includes("payment")) return <CreditCard size={13} />;
  if (id.includes("inventory")) return <Package size={13} />;
  if (id.includes("order")) return <ShoppingCart size={13} />;
  if (id.includes("shipping")) return <Truck size={13} />;
  if (id.includes("notification")) return <Bell size={13} />;
  if (id.includes("analytics")) return <BarChart2 size={13} />;
  if (id.includes("catalog")) return <Package size={13} />;

  return <Server size={13} />;
}

// Compute cubic bezier curve between source and target cards
function computeBezierCurve(srcPos, tgtPos) {
  let x1, y1, x2, y2;
  let cp1x, cp1y, cp2x, cp2y;

  const dx = tgtPos.x - srcPos.x;

  if (dx > CARD_WIDTH * 0.4) {
    x1 = srcPos.x + CARD_WIDTH;
    y1 = srcPos.y + CARD_HEIGHT * 0.5;
    x2 = tgtPos.x;
    y2 = tgtPos.y + CARD_HEIGHT * 0.5;
    const offset = Math.max(50, (x2 - x1) * 0.5);
    cp1x = x1 + offset;
    cp1y = y1;
    cp2x = x2 - offset;
    cp2y = y2;
  } else if (dx < -CARD_WIDTH * 0.4) {
    x1 = srcPos.x;
    y1 = srcPos.y + CARD_HEIGHT * 0.5;
    x2 = tgtPos.x + CARD_WIDTH;
    y2 = tgtPos.y + CARD_HEIGHT * 0.5;
    const offset = Math.max(50, (x1 - x2) * 0.5);
    cp1x = x1 - offset;
    cp1y = y1;
    cp2x = x2 + offset;
    cp2y = y2;
  } else {
    if (tgtPos.y > srcPos.y) {
      x1 = srcPos.x + CARD_WIDTH * 0.5;
      y1 = srcPos.y + CARD_HEIGHT;
      x2 = tgtPos.x + CARD_WIDTH * 0.5;
      y2 = tgtPos.y;
      const offset = Math.max(30, (y2 - y1) * 0.5);
      cp1x = x1;
      cp1y = y1 + offset;
      cp2x = x2;
      cp2y = y2 - offset;
    } else {
      x1 = srcPos.x + CARD_WIDTH * 0.5;
      y1 = srcPos.y;
      x2 = tgtPos.x + CARD_WIDTH * 0.5;
      y2 = tgtPos.y + CARD_HEIGHT;
      const offset = Math.max(30, (y1 - y2) * 0.5);
      cp1x = x1;
      cp1y = y1 - offset;
      cp2x = x2;
      cp2y = y2 + offset;
    }
  }

  const t = 0.5;
  const midX =
    (1 - t) ** 3 * x1 +
    3 * (1 - t) ** 2 * t * cp1x +
    3 * (1 - t) * t ** 2 * cp2x +
    t ** 3 * x2;
  const midY =
    (1 - t) ** 3 * y1 +
    3 * (1 - t) ** 2 * t * cp1y +
    3 * (1 - t) * t ** 2 * cp2y +
    t ** 3 * y2;

  return {
    path: `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`,
    midX,
    midY,
  };
}

export default function GraphPanel({
  graphData,
  activeImpact,
  selectedNode,
  onSelectNode,
  viewMode,
  onChangeViewMode,
  onRefreshGraph,
  onInvestigateService,
  isLoading,
  animationStep = null,
  isPlaying = false,
  onPlayAnimation,
  onPauseAnimation,
  onResetAnimation,
  onStepForward,
  onStepBackward,
  selectedHops = 5,
  onHopChange,
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState({ x: 25, y: 25 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [auditService, setAuditService] = useState(null);

  const failed = activeImpact?.failedService;
  const failedId = failed?.id;
  const affected = activeImpact?.affectedServices || [];

  const maxSteps = useMemo(() => {
    if (!affected || affected.length === 0) return 0;
    const hopsArr = affected.map((s) => Number(s.hops) || 1);
    return Math.max(...hopsArr);
  }, [affected]);

  const currentStepService = useMemo(() => {
    if (!activeImpact) return null;
    if (animationStep === 0 || animationStep === null) return failed;
    return affected.find((s) => s.hops === animationStep) || affected[0] || failed;
  }, [activeImpact, animationStep, affected, failed]);

  const affectedMap = useMemo(() => {
    const map = new Map();
    if (activeImpact?.affectedServices) {
      activeImpact.affectedServices.forEach((s) => {
        map.set(s.id, s);
      });
    }
    return map;
  }, [activeImpact]);

  // Compute node status: 'failed' | 'affected' | 'healthy' | 'external'
  const getNodeStatus = (node) => {
    if (!activeImpact) {
      if (node.type === "ExternalSystem" || node.type === "Database" || node.type === "Queue") {
        return "external";
      }
      return "healthy";
    }
    if (node.id === failedId) return "failed";
    const affected = affectedMap.get(node.id);
    if (affected) {
      if (typeof animationStep === "number" && animationStep < affected.hops) {
        return "healthy";
      }
      return "affected";
    }
    if (node.type === "ExternalSystem" || node.type === "Database" || node.type === "Queue") {
      return "external";
    }
    return "healthy";
  };

  // Node positions map
  const nodePositions = useMemo(() => {
    const pos = { ...DEFAULT_NODE_POSITIONS };
    const nodes = graphData?.nodes || [];

    nodes.forEach((n, idx) => {
      if (!pos[n.id]) {
        const col = idx % 5;
        const row = Math.floor(idx / 5);
        pos[n.id] = { x: 40 + col * 340, y: 40 + row * 190 };
      }
    });

    return pos;
  }, [graphData]);

  // Cursor-sensitive wheel zoom: zooms towards the mouse position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Do not intercept wheel when cursor is over the audit modal
      if (e.target.closest(".risk-audit-modal") || e.target.closest(".custom-audit-scrollbar")) {
        return;
      }
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.07 : 0.93;
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.35, Math.min(2.2, +(prevZoom * zoomFactor).toFixed(3)));
        const scale = newZoom / prevZoom;
        setPan((prevPan) => ({
          x: mouseX - scale * (mouseX - prevPan.x),
          y: mouseY - scale * (mouseY - prevPan.y),
        }));
        return newZoom;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Drag handlers for panning
  const handleMouseDown = (e) => {
    // Only left-click, skip interactive elements
    if (e.button !== 0) return;
    if (e.target.closest("button, select, input, .risk-audit-modal, .graph-node-card")) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (containerRef.current) containerRef.current.style.cursor = "grab";
    }
  };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseleave", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mouseleave", handleMouseUp);
    };
  }, []);

  const handleZoom = (delta) => {
    setZoom((prev) => Math.max(0.35, Math.min(2.2, +(prev + delta).toFixed(2))));
  };

  const handleResetFit = () => {
    setZoom(0.82);
    setPan({ x: 25, y: 25 });
  };

  return (
    <div className="panel graph-panel">
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-wrap">
            <Database size={18} />
          </div>
          <div>
            <h2 className="panel-title">FalkorDB (Database Graph)</h2>
            <div className="panel-subtitle">Live service dependency graph from FalkorDB</div>
          </div>
        </div>

        <div className="graph-controls">
          {/* Quick Animate Ripple Button right on the Graph */}
          {activeImpact && onPlayAnimation && (
            <button
              type="button"
              className={isPlaying ? "btn-secondary" : "btn-primary"}
              style={{
                padding: "5px 12px",
                fontSize: 11.5,
                gap: 6,
                borderRadius: 8,
                backgroundColor: isPlaying ? "var(--orange-light)" : undefined,
                color: isPlaying ? "var(--orange)" : undefined,
                borderColor: isPlaying ? "var(--orange-border)" : undefined,
              }}
              onClick={isPlaying ? onPauseAnimation : onPlayAnimation}
              title={isPlaying ? "Pause propagation animation" : "Animate impact propagation on graph"}
            >
              {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
              <span>{isPlaying ? "Pause Ripple" : "Animate Ripple"}</span>
            </button>
          )}

          {/* Quick Hop selector */}
          {activeImpact && onHopChange && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Hops:</span>
              <select
                className="select-control"
                style={{ padding: "4px 8px", fontSize: 11 }}
                value={selectedHops}
                onChange={(e) => onHopChange(Number(e.target.value))}
                title="Max propagation hop depth"
              >
                <option value={1}>1 Hop</option>
                <option value={2}>2 Hops</option>
                <option value={3}>3 Hops</option>
                <option value={4}>4 Hops</option>
                <option value={5}>5 Hops</option>
              </select>
            </div>
          )}

          <select
            className="select-control"
            value={viewMode}
            onChange={(e) => onChangeViewMode(e.target.value)}
          >
            <option value="service">Service View</option>
            <option value="all">Full Architecture</option>
          </select>

          <button
            type="button"
            className="btn-icon"
            onClick={onRefreshGraph}
            title="Refresh graph from FalkorDB"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={() => handleZoom(0.12)}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={() => handleZoom(-0.12)}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={handleResetFit}
            title="Fit to View"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div
        className="graph-viewport"
        ref={containerRef}
        style={{ cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <defs>
            {/* Arrow markers for edges in warm palette */}
            <marker
              id="arrow-neutral-warm"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#CDBB9F" />
            </marker>
            <marker
              id="arrow-critical-warm"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#F04432" />
            </marker>
            <marker
              id="arrow-impact-warm"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FF922E" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Smooth Bezier Edges */}
            {(graphData?.edges || []).map((edge) => {
              const srcPos = nodePositions[edge.source];
              const tgtPos = nodePositions[edge.target];
              if (!srcPos || !tgtPos) return null;

              const isDirectFailed =
                Boolean(failedId) &&
                (edge.target === failedId || edge.source === failedId) &&
                (typeof animationStep !== "number" || animationStep >= 1);

              const isAffectedEdge =
                Boolean(activeImpact) &&
                (affectedMap.has(edge.source) || affectedMap.has(edge.target)) &&
                (typeof animationStep !== "number" || animationStep >= 2);

              let strokeColor = "#CDBB9F";
              let marker = "url(#arrow-neutral-warm)";
              let strokeWidth = 1.5;
              let isPulsing = false;

              if (isDirectFailed) {
                strokeColor = "#F04432";
                marker = "url(#arrow-critical-warm)";
                strokeWidth = 2.4;
                isPulsing = true;
              } else if (isAffectedEdge) {
                strokeColor = "#FF922E";
                marker = "url(#arrow-impact-warm)";
                strokeWidth = 2.0;
                isPulsing = true;
              }

              const curve = computeBezierCurve(srcPos, tgtPos);

              return (
                <g key={edge.id || `${edge.source}-${edge.target}`}>
                  <path
                    d={curve.path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isPulsing ? "6 3" : undefined}
                    style={
                      isPulsing
                        ? { animation: "dashFlow 1.5s linear infinite" }
                        : undefined
                    }
                    markerEnd={marker}
                  />

                  {/* Relationship label pill */}
                  <rect
                    x={curve.midX - 32}
                    y={curve.midY - 8}
                    width={64}
                    height={16}
                    rx={4}
                    fill="#FBF8F1"
                    stroke={strokeColor}
                    strokeWidth={0.9}
                  />
                  <text
                    x={curve.midX}
                    y={curve.midY + 3.5}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="600"
                    fill="#716B60"
                    letterSpacing="0.04em"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {edge.type}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Nodes Layer: Warm Theme Observability Cards */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            pointerEvents: "auto",
          }}
        >
          {(graphData?.nodes || []).map((node) => {
            const pos = nodePositions[node.id] || { x: 100, y: 100 };
            const status = getNodeStatus(node);
            const isSelected = selectedNode?.id === node.id;
            const category = getNodeCategory(node);
            const displayName = getNodeDisplayName(node);

            // Metrics styled with the warm theme tokens
            let errorRate = "0%";
            let errorClass = "healthy";
            let duration = "43.16MS";
            let reqRate = "5.1REQ/S";

            if (status === "failed") {
              errorRate = "86.11%";
              errorClass = "failed";
              duration = "4,210MS";
              reqRate = "0.2REQ/S";
            } else if (status === "affected") {
              errorRate = "44.16%";
              errorClass = "affected";
              duration = "1,280MS";
              reqRate = "4.8REQ/S";
            } else if (node.type === "Database" || node.id.startsWith("db-")) {
              errorRate = "0%";
              errorClass = "external";
              duration = "12.40MS";
              reqRate = "42.0OPS/S";
            } else if (node.type === "Queue") {
              errorRate = "0%";
              errorClass = "external";
              duration = "4.10MS";
              reqRate = "120MSG/S";
            }

            const statusColor =
              status === "failed"
                ? "var(--red)"
                : status === "affected"
                ? "var(--orange)"
                : status === "external"
                ? "var(--blue)"
                : "var(--green)";

            const statusText =
              status === "failed"
                ? "FAILED"
                : status === "affected"
                ? "AFFECTED"
                : status === "external"
                ? "EXTERNAL"
                : "HEALTHY";

            const borderColor =
              status === "failed"
                ? "var(--red)"
                : status === "affected"
                ? "var(--orange)"
                : isSelected
                ? "var(--blue)"
                : "var(--border)";

            const iconBg =
              status === "failed"
                ? "var(--red-light)"
                : status === "affected"
                ? "var(--orange-light)"
                : "var(--panel-muted)";

            const iconColor =
              status === "failed"
                ? "var(--red)"
                : status === "affected"
                ? "var(--orange)"
                : "var(--text)";

            const glowShadow =
              status === "failed"
                ? "0 0 24px rgba(240, 68, 50, 0.45)"
                : status === "affected"
                ? "0 0 14px rgba(255, 146, 46, 0.3)"
                : isSelected
                ? "0 0 12px rgba(80, 124, 166, 0.35)"
                : "0 2px 6px rgba(0, 0, 0, 0.04)";

            return (
              <div
                key={node.id}
                className="graph-node-card obs-card"
                onClick={() => onSelectNode(node)}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  borderRadius: 12,
                  backgroundColor: "var(--panel)",
                  border: `1.5px solid ${borderColor}`,
                  boxShadow: glowShadow,
                  padding: "9px 12px 8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  userSelect: "none",
                  overflow: "hidden",
                  transition: "transform 0.15s ease, border-color 0.2s, box-shadow 0.2s",
                }}
              >
                {/* Top Header Row: TYPE (left) + STATUS BADGE LIKE BEFORE (right) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "var(--muted)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    <span>{node.type || "SERVICE"}</span>{" "}
                    <span style={{ color: "var(--muted-light)" }}>({category})</span>
                  </div>

                  {/* Status dot + text exactly like before */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4.5,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.03em",
                      color: statusColor,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "currentColor",
                        boxShadow:
                          status === "failed" || status === "affected"
                            ? `0 0 6px ${statusColor}`
                            : undefined,
                      }}
                    />
                    <span>{statusText}</span>
                  </div>
                </div>

                {/* Service Name Title with Icon Container like before */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 2,
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      backgroundColor: iconBg,
                      color: iconColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getNodeIcon(node)}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-display, inherit)",
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={displayName}
                  >
                    {displayName}
                  </span>
                </div>

                {/* Subtle Divider */}
                <div
                  style={{
                    height: 1,
                    backgroundColor: "var(--border-light)",
                    marginBottom: 3,
                  }}
                />

                {/* Metrics Rows (Warm palette pills) */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3.5,
                    fontSize: 9.5,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {/* Row 1: Request Error Rate */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "var(--muted)",
                    }}
                  >
                    <span>Request Error Rate</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        color:
                          errorClass === "failed"
                            ? "var(--red)"
                            : errorClass === "affected"
                            ? "var(--orange)"
                            : errorClass === "external"
                            ? "var(--blue)"
                            : "var(--green)",
                        border: `1px solid ${
                          errorClass === "failed"
                            ? "var(--red-border)"
                            : errorClass === "affected"
                            ? "var(--orange-border)"
                            : errorClass === "external"
                            ? "var(--blue-border)"
                            : "var(--green-border)"
                        }`,
                        backgroundColor:
                          errorClass === "failed"
                            ? "var(--red-light)"
                            : errorClass === "affected"
                            ? "var(--orange-light)"
                            : errorClass === "external"
                            ? "var(--blue-light)"
                            : "var(--green-light)",
                      }}
                    >
                      {errorRate}
                    </span>
                  </div>

                  {/* Row 2: Request Duration */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "var(--muted)",
                    }}
                  >
                    <span>Request Duration</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        color:
                          status === "failed"
                            ? "var(--red)"
                            : status === "affected"
                            ? "var(--orange)"
                            : "var(--green)",
                        border: `1px solid ${
                          status === "failed"
                            ? "var(--red-border)"
                            : status === "affected"
                            ? "var(--orange-border)"
                            : "var(--green-border)"
                        }`,
                        backgroundColor:
                          status === "failed"
                            ? "var(--red-light)"
                            : status === "affected"
                            ? "var(--orange-light)"
                            : "var(--green-light)",
                      }}
                    >
                      {duration}
                    </span>
                  </div>

                  {/* Row 3: Request Rate */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "var(--muted)",
                    }}
                  >
                    <span>Request Rate</span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        color: "var(--text)",
                        border: "1px solid var(--border-light)",
                        backgroundColor: "var(--panel-muted)",
                      }}
                    >
                      {reqRate}
                    </span>
                  </div>
                </div>

                {/* Footer Quick Action Icons */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 3,
                    paddingTop: 3,
                    borderTop: "1px solid var(--border-light)",
                    color: "var(--muted-light)",
                  }}
                >
                  <button
                    type="button"
                    title="Audit degree centrality & risk score calculation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAuditService(node);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      margin: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    <Info size={11} className="hover:text-amber-800 transition-colors" />
                  </button>
                  <Activity size={11} className="hover:text-amber-800 transition-colors" />
                  <Cpu size={11} className="hover:text-amber-800 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Node Details Card / Inspector popup */}
        {selectedNode && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              backgroundColor: "rgba(251, 248, 241, 0.96)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "14px 18px",
              boxShadow: "0 10px 25px rgba(70, 50, 20, 0.12)",
              zIndex: 20,
              maxWidth: 280,
              fontSize: 12,
              color: "var(--text)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                {selectedNode.name || selectedNode.label}
              </div>
              <button
                type="button"
                onClick={() => onSelectNode(null)}
                style={{ fontSize: 13, color: "var(--muted)", padding: "0 4px", background: "none", border: "none", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
              <div><strong style={{ color: "var(--text)" }}>ID:</strong> {selectedNode.id}</div>
              <div><strong style={{ color: "var(--text)" }}>Type:</strong> {selectedNode.type}</div>
              {selectedNode.criticality && (
                <div><strong style={{ color: "var(--text)" }}>Criticality:</strong> {selectedNode.criticality} / 5</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedNode.type === "Service" && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "7px 12px",
                    fontSize: 11.5,
                    borderRadius: 6,
                  }}
                  onClick={() => {
                    onInvestigateService(selectedNode);
                    onSelectNode(null);
                  }}
                >
                  Simulate Failure Impact
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "6px 12px",
                  fontSize: 11.5,
                  borderRadius: 6,
                }}
                onClick={() => {
                  setAuditService(selectedNode);
                }}
              >
                Audit Risk & Centrality
              </button>
            </div>
          </div>
        )}

        {/* Floating Impact Propagation & Animation Dock */}
        {activeImpact && (
          <div
            className="graph-floating-dock animate-fade-in"
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              backgroundColor: "rgba(251, 248, 241, 0.96)",
              backdropFilter: "blur(12px)",
              border: "1.5px solid var(--border)",
              borderRadius: 12,
              padding: "8px 14px",
              boxShadow: "0 8px 24px rgba(70, 50, 20, 0.12)",
              zIndex: 15,
              display: "flex",
              alignItems: "center",
              gap: 12,
              maxWidth: "calc(100% - 220px)",
            }}
          >
            {/* Propagation Step Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  backgroundColor: isPlaying ? "var(--orange)" : "var(--red)",
                  boxShadow: `0 0 8px ${isPlaying ? "var(--orange)" : "var(--red)"}`,
                }}
                className={isPlaying ? "animate-pulse" : ""}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                  {isPlaying
                    ? `Propagating Impact: Step ${animationStep ?? 0}/${maxSteps}`
                    : animationStep !== null
                    ? `Step ${animationStep}/${maxSteps}: ${currentStepService?.name || "Service"}`
                    : `Active Root: ${failed?.name || "Root"}`}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {affected.length} service{affected.length === 1 ? "" : "s"} affected • {selectedHops} hops
                </span>
              </div>
            </div>

            <div style={{ height: 20, width: 1, backgroundColor: "var(--border)" }} />

            {/* Play/Pause/Step Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button
                type="button"
                className="btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={onStepBackward}
                title="Step backward"
                disabled={!animationStep || animationStep <= 0}
              >
                <ChevronLeft size={13} />
              </button>

              <button
                type="button"
                className="btn-primary"
                style={{ padding: "4px 10px", fontSize: 11, gap: 5, borderRadius: 6 }}
                onClick={isPlaying ? onPauseAnimation : onPlayAnimation}
                title={isPlaying ? "Pause ripple animation" : "Play ripple animation"}
              >
                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                <span>{isPlaying ? "Pause" : "Animate"}</span>
              </button>

              <button
                type="button"
                className="btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={onStepForward}
                title="Step forward"
                disabled={animationStep !== null && animationStep >= maxSteps}
              >
                <ChevronRight size={13} />
              </button>

              <button
                type="button"
                className="btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={onResetAnimation}
                title="Reset animation"
              >
                <RotateCcw size={12} />
              </button>
            </div>

            <div style={{ height: 20, width: 1, backgroundColor: "var(--border)" }} />

            {/* Button to open the Risk & Path Explanation Audit */}
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "4px 10px", fontSize: 11, gap: 5, borderRadius: 6 }}
              onClick={() => {
                setAuditService(currentStepService || failed);
              }}
              title="Open Risk & Path Explanation Audit modal"
            >
              <Calculator size={13} color="var(--orange)" />
              <span>Risk Audit</span>
            </button>
          </div>
        )}

        {/* Risk & Path Explanation Audit Modal */}
        {auditService && (
          <RiskAuditModal
            service={auditService}
            rootFailed={activeImpact?.failedService}
            onClose={() => setAuditService(null)}
          />
        )}

        {/* Graph Legend */}
        <div className="graph-legend-floating">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "var(--red)" }} />
            <span>Failed Service</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "var(--orange)" }} />
            <span>Affected Service</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "var(--green)" }} />
            <span>Healthy Service</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: "var(--blue)" }} />
            <span>Storage / DB / Queue</span>
          </div>
        </div>
      </div>
    </div>
  );
}
