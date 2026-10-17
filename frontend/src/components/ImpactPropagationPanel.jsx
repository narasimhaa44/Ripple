import React, { useState, useEffect, useMemo } from "react";
import {
  GitBranch,
  Play,
  Pause,
  RotateCcw,
  Package,
  ShoppingCart,
  Truck,
  BarChart2,
  Shield,
  CreditCard,
  Bell,
  Database,
  CheckCircle2,
  Layers,
  Server,
  HelpCircle,
  X,
  Calculator,
  Compass,
  ArrowRight,
} from "lucide-react";
import RiskAuditModal, { getCentralityInfo } from "./RiskAuditModal";


function getServiceIcon(id = "") {
  if (id.includes("inventory")) return <Package size={17} />;
  if (id.includes("order")) return <ShoppingCart size={17} />;
  if (id.includes("shipping")) return <Truck size={17} />;
  if (id.includes("analytics")) return <BarChart2 size={17} />;
  if (id.includes("auth")) return <Shield size={17} />;
  if (id.includes("payment")) return <CreditCard size={17} />;
  if (id.includes("notification")) return <Bell size={17} />;
  return <Server size={17} />;
}

export default function ImpactPropagationPanel({
  activeImpact,
  onReset,
  selectedHops = 5,
  onHopChange,
  onStepChange,
  animationStep: controlledStep,
  isPlaying: controlledIsPlaying,
  onPlayAnimation,
  onPauseAnimation,
}) {
  const [localStep, setLocalStep] = useState(0);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [auditService, setAuditService] = useState(null);

  const isControlled = controlledStep !== undefined && controlledIsPlaying !== undefined;
  const animationStep = isControlled ? controlledStep : localStep;
  const isPlaying = isControlled ? controlledIsPlaying : localIsPlaying;

  const setAnimationStep = (val) => {
    if (typeof val === "function") {
      setLocalStep(val);
    } else {
      setLocalStep(val);
    }
    if (onStepChange) onStepChange(val);
  };

  const setIsPlaying = (val) => {
    setLocalIsPlaying(val);
  };

  const failed = activeImpact?.failedService;
  const affected = activeImpact?.affectedServices || [];
  const workflows = activeImpact?.affectedWorkflows || [];
  const currentHops = selectedHops || activeImpact?.maxHops || 5;

  // Group affected services by hops dynamically (1..5)
  const hopsMap = useMemo(() => {
    const map = new Map();
    affected.forEach((s) => {
      const h = Number(s.hops) || 1;
      if (!map.has(h)) map.set(h, []);
      map.get(h).push(s);
    });
    return map;
  }, [affected]);

  const distinctHops = useMemo(() => {
    return Array.from(hopsMap.keys()).sort((a, b) => a - b);
  }, [hopsMap]);

  const maxHopInImpact = distinctHops.length > 0 ? Math.max(...distinctHops) : 0;
  const maxSteps = Math.min(currentHops, maxHopInImpact);

  // Notify parent of animation step for syncing with GraphPanel if uncontrolled
  useEffect(() => {
    if (!isControlled && onStepChange) {
      onStepChange(isPlaying ? animationStep : null);
    }
  }, [animationStep, isPlaying, onStepChange, isControlled]);

  // Restart animation whenever failed service or hop limit changes
  useEffect(() => {
    if (!isControlled) {
      if (failed) {
        if (maxSteps === 0) {
          setLocalStep(0);
          setLocalIsPlaying(false);
        } else {
          setLocalStep(0);
          setLocalIsPlaying(true);
        }
      } else {
        setLocalStep(0);
        setLocalIsPlaying(false);
      }
    }
    setAuditService(null);
  }, [failed?.id, currentHops, maxSteps, isControlled]);

  // Animation step timer if uncontrolled
  useEffect(() => {
    if (isControlled) return;
    let timer;
    if (localIsPlaying) {
      if (localStep < maxSteps) {
        timer = setTimeout(() => {
          setLocalStep((prev) => prev + 1);
        }, 850);
      } else {
        setLocalIsPlaying(false);
      }
    }
    return () => clearTimeout(timer);
  }, [localIsPlaying, localStep, maxSteps, isControlled]);

  const handlePlayAnimation = () => {
    if (onPlayAnimation) {
      onPlayAnimation();
    } else {
      setLocalStep(0);
      setLocalIsPlaying(true);
    }
  };

  const handleReset = () => {
    if (!isControlled) {
      setLocalIsPlaying(false);
      setLocalStep(0);
    }
    setAuditService(null);
    if (onReset) onReset();
  };


  if (!failed) {
    return (
      <div className="panel impact-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <div className="panel-icon-wrap">
              <GitBranch size={18} />
            </div>
            <div>
              <h2 className="panel-title">Impact Propagation</h2>
              <div className="panel-subtitle">Animated view of how the failure spreads through the system</div>
            </div>
          </div>
        </div>
        <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--muted)" }}>
          <p style={{ fontSize: 14 }}>
            No service failure investigated yet. Ask a question or click a service node in the graph to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel impact-panel" style={{ position: "relative" }}>
      <div className="panel-header">
        <div className="panel-title-area">
          <div className="panel-icon-wrap">
            <GitBranch size={18} />
          </div>
          <div>
            <h2 className="panel-title">Impact Propagation</h2>
            <div className="panel-subtitle">
              Graph propagation with degree centrality & explainable risk scoring
            </div>
          </div>
        </div>

        <div className="impact-actions">
          {/* Hop Selector (1-5) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>Hops:</span>
            <select
              className="select-control"
              value={currentHops}
              onChange={(e) => onHopChange && onHopChange(Number(e.target.value))}
              title="Select maximum propagation hops"
            >
              <option value={1}>1 Hop</option>
              <option value={2}>2 Hops</option>
              <option value={3}>3 Hops</option>
              <option value={4}>4 Hops</option>
              <option value={5}>5 Hops</option>
            </select>
          </div>

          {isPlaying && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--orange)",
                backgroundColor: "var(--orange-light)",
                border: "1px solid var(--orange-border)",
                padding: "4px 8px",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "var(--orange)",
                }}
                className="animate-pulse"
              />
              Step {animationStep || 0} / {maxSteps}
            </span>
          )}

          <button
            type="button"
            className={isPlaying ? "btn-secondary" : "btn-primary"}
            onClick={isPlaying ? (onPauseAnimation || (() => setIsPlaying(false))) : handlePlayAnimation}
            disabled={maxSteps === 0}
            title={maxSteps === 0 ? "No downstream services to animate" : isPlaying ? "Pause animation" : "Play propagation animation"}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              borderRadius: 8,
              backgroundColor: isPlaying ? "var(--orange-light)" : undefined,
              color: isPlaying ? "var(--orange)" : undefined,
              borderColor: isPlaying ? "var(--orange-border)" : undefined,
            }}
          >
            {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            <span>{isPlaying ? "Pause" : "Play Animation"}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            title="Reset propagation animation"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="impact-content-grid">
        {/* Left Side: > Propagation Path */}
        <div className="propagation-path-list">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="path-section-title">&gt; Propagation Path</div>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Click service to audit math</span>
          </div>

          {/* Step 1: Failed Service */}
          <div
            className="path-step-card"
            style={{ borderColor: "var(--red-border)", cursor: "pointer" }}
            onClick={() => setAuditService({ ...failed, hops: 0, riskScore: 100, severity: "CRITICAL" })}
          >
            <div className="path-step-left">
              <div
                className="path-step-num step-num-1"
                style={{
                  width: 26,
                  height: 26,
                  minWidth: 26,
                  minHeight: 26,
                  borderRadius: "50%",
                  flexShrink: 0,
                  aspectRatio: "1 / 1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11.5,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                1
              </div>
              <div className="path-step-info">
                <span className="path-step-name">{failed.name}</span>
                <span className="path-step-desc">
                  Root Failure • {failed.centralityLabel || "Origin"}
                </span>
              </div>
            </div>
            <div className="severity-pill failed">FAILED</div>
          </div>

          {/* If no downstream dependents exist */}
          {affected.length === 0 && (
            <div
              className="animate-fade-in"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                backgroundColor: "var(--panel)",
                border: "1px dashed var(--border)",
                borderRadius: 10,
                marginTop: 6,
              }}
            >
              <CheckCircle2 size={16} color="var(--green)" />
              <div style={{ fontSize: 12, color: "var(--text)" }}>
                <strong>No downstream dependents:</strong> Failure is isolated to {failed.name}. No other services are affected within {currentHops} hop{currentHops > 1 ? "s" : ""}.
              </div>
            </div>
          )}

          {/* Downstream affected services */}
          {affected.map((service, index) => {
            const stepNum = index + 2;
            const stepClass =
              stepNum === 2
                ? "step-num-2"
                : stepNum === 3
                  ? "step-num-3"
                  : "step-num-4";
            const sevClass = (service.severity || "HIGH").toLowerCase();
            const isRevealed = !isPlaying || animationStep >= service.hops;
            const isSelected = auditService?.id === service.id;

            return (
              <div
                key={service.id}
                className="path-step-card animate-fade-in"
                onClick={() => setAuditService(service)}
                style={{
                  opacity: isRevealed ? 1 : 0.35,
                  transform: isRevealed ? "scale(1)" : "scale(0.98)",
                  transition: "all 0.35s ease",
                  cursor: "pointer",
                  borderColor: isSelected ? "var(--blue)" : undefined,
                  backgroundColor: isSelected ? "var(--panel)" : undefined,
                }}
                title="Click to view full mathematical risk audit & path explanation"
              >
                <div className="path-step-left">
                  <div
                    className={`path-step-num ${stepClass}`}
                    style={{
                      width: 26,
                      height: 26,
                      minWidth: 26,
                      minHeight: 26,
                      borderRadius: "50%",
                      flexShrink: 0,
                      aspectRatio: "1 / 1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {stepNum}
                  </div>
                  <div className="path-step-info">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="path-step-name">{service.name}</span>
                      {(() => {
                        const cent = getCentralityInfo(service.inDegree);
                        return (
                          <span
                            style={{
                              fontSize: 9.5,
                              padding: "1px 6px",
                              borderRadius: 4,
                              backgroundColor: cent.tagBg,
                              color: cent.tagColor,
                              fontWeight: 700,
                              border: `1px solid ${cent.tagBorder}`,
                            }}
                          >
                            {cent.tag}
                          </span>
                        );
                      })()}
                    </div>
                    <span className="path-step-desc">
                      {service.hops} hop{service.hops > 1 ? "s" : ""} away • Heuristic Risk Score: {service.riskScore}/100 • {getCentralityInfo(service.inDegree).tierLabel}
                    </span>
                    {service.evidencePath && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "var(--muted)",
                          marginTop: 2,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {service.evidencePath.join(" → ")}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className={`severity-pill ${sevClass}`}>{service.severity}</div>
                  <HelpCircle size={14} color="var(--muted)" />
                </div>
              </div>
            );
          })}

          {/* Impacted Workflows note if returned */}
          {workflows.length > 0 && (
            <div
              style={{
                marginTop: 6,
                padding: "8px 12px",
                backgroundColor: "var(--panel)",
                borderRadius: 8,
                border: "1px solid var(--border-light)",
                fontSize: 11.5,
                color: "var(--muted)",
              }}
            >
              <strong style={{ color: "var(--text)" }}>Impacted Workflows: </strong>
              {workflows.map((w) => `${w.name} (${w.severity})`).join(", ")}
            </div>
          )}
        </div>

        {/* Right Side: Animated Dynamic Propagation Flow Diagram — VERTICAL */}
        <div className="propagation-visual-box">
          <div
            className="custom-audit-scrollbar"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: affected.length === 0 ? "center" : "flex-start",
              position: "relative",
              minHeight: 180,
              gap: 0,
              padding: "24px 16px",
              overflowY: "auto",
              overflowX: "hidden",
              width: "100%",
              scrollBehavior: "smooth",
            }}
          >
            {/* 1. Failed Service Node with Concentric Pulsing Ripples */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                flexShrink: 0,
                cursor: "pointer",
                marginBottom: 4,
              }}
              onClick={() => setAuditService({ ...failed, hops: 0, riskScore: 100, severity: "CRITICAL" })}
            >
              {/* Concentric ripple rings */}
              <div
                style={{
                  position: "absolute",
                  top: -16,
                  left: "50%",
                  marginLeft: -43,
                  width: 86,
                  height: 86,
                  borderRadius: "50%",
                  backgroundColor: "rgba(240, 68, 50, 0.06)",
                  border: "1.5px solid rgba(240, 68, 50, 0.18)",
                  pointerEvents: "none",
                  animation: "rippleWave 2.4s ease-out infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  left: "50%",
                  marginLeft: -35,
                  width: 70,
                  height: 70,
                  borderRadius: "50%",
                  backgroundColor: "rgba(240, 68, 50, 0.10)",
                  pointerEvents: "none",
                }}
              />
              {/* Node circle */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  minWidth: 56,
                  minHeight: 56,
                  borderRadius: "50%",
                  flexShrink: 0,
                  aspectRatio: "1 / 1",
                  backgroundColor: "var(--panel)",
                  border: "2.5px solid var(--red)",
                  color: "var(--red)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 20px rgba(240, 68, 50, 0.4)",
                  zIndex: 2,
                }}
              >
                {getServiceIcon(failed.id)}
              </div>
              <span style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "var(--text)", textAlign: "center", maxWidth: 110, lineHeight: 1.2 }}>
                {failed.name}
              </span>
              <span style={{ marginTop: 3, fontSize: 9.5, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Origin (0 Hops)
              </span>
            </div>

            {/* If zero downstream dependents */}
            {affected.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, backgroundColor: "var(--panel)", border: "1.5px dashed var(--green)", borderRadius: 12, padding: "14px 18px", marginTop: 18 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "var(--green-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)" }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>Zero Downstream Blast Radius</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 220, marginTop: 2 }}>No other services depend on {failed.name}. The failure is safely contained.</div>
                </div>
              </div>
            )}

            {/* Dynamic Vertical Rendering for each Hop Level */}
            {distinctHops.map((hopNumber) => {
              const servicesAtHop = hopsMap.get(hopNumber) || [];
              const isHopActive = !isPlaying || animationStep >= hopNumber;
              const isDirectHop = hopNumber === 1;
              const arrowColor = isDirectHop ? "#F04432" : "#FF922E";
              return (
                <React.Fragment key={`hop-group-${hopNumber}`}>
                  {/* Vertical Animated Connector Arrow */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: arrowColor, transition: "opacity 0.4s ease", opacity: isHopActive ? 1 : 0.25, flexShrink: 0, margin: "2px 0" }}>
                    <svg width="24" height="40" viewBox="0 0 24 40">
                      <line x1="12" y1="2" x2="12" y2="32" stroke={arrowColor} strokeWidth="2.5" strokeDasharray={isPlaying && isHopActive ? "5 3" : undefined} style={isPlaying && isHopActive ? { animation: "dashFlowVertical 1.2s linear infinite" } : undefined} />
                      <polygon points="7,32 12,40 17,32" fill={arrowColor} />
                    </svg>
                    <span style={{ fontSize: 9, fontWeight: 700, color: arrowColor, fontFamily: "ui-monospace, monospace", marginTop: -2 }}>
                      {isDirectHop ? "1-HOP" : `${hopNumber}-HOPS`}
                    </span>
                  </div>
                  {/* Hop Services Row */}
                  <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", flexShrink: 0, transition: "all 0.4s ease", opacity: isHopActive ? 1 : 0.35, transform: isHopActive ? "scale(1) translateY(0)" : "scale(0.95) translateY(-6px)" }}>
                    {servicesAtHop.map((s) => (
                      <div key={s.id} onClick={() => setAuditService(s)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", transition: "all 0.3s ease" }} title="Click to view explainable risk formula audit">
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            minWidth: 48,
                            minHeight: 48,
                            borderRadius: "50%",
                            flexShrink: 0,
                            aspectRatio: "1 / 1",
                            backgroundColor: "var(--panel)",
                            border: `2px solid ${isHopActive ? arrowColor : "var(--border)"}`,
                            color: isHopActive ? arrowColor : "var(--muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: isHopActive
                              ? isDirectHop
                                ? "0 0 16px rgba(240, 68, 50, 0.3)"
                                : "0 0 14px rgba(255, 146, 46, 0.3)"
                              : "0 1px 4px rgba(0,0,0,0.05)",
                            transition: "all 0.3s ease",
                          }}
                        >
                          {getServiceIcon(s.id)}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textAlign: "center", maxWidth: 100, lineHeight: 1.2 }}>{s.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: arrowColor, textAlign: "center" }}>Risk {s.riskScore}/100</span>
                      </div>
                    ))}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Visual Legend Bar */}
          <div className="visual-legend-bar">
            <div className="visual-legend-item">
              <svg width="24" height="12" viewBox="0 0 24 12"><line x1="0" y1="6" x2="18" y2="6" stroke="#F04432" strokeWidth="2.5" /><polygon points="18,3 24,6 18,9" fill="#F04432" /></svg>
              <span>Critical path (Direct 1-Hop)</span>
            </div>
            <div className="visual-legend-item">
              <svg width="24" height="12" viewBox="0 0 24 12"><line x1="0" y1="6" x2="18" y2="6" stroke="#FF922E" strokeWidth="2" /><polygon points="18,3 24,6 18,9" fill="#FF922E" /></svg>
              <span>Indirect impact (&gt;1 Hop)</span>
            </div>
            <div className="visual-legend-item">
              <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="#F04432" strokeWidth="1" opacity="0.3" /><circle cx="8" cy="4.5" fill="none" stroke="#F04432" strokeWidth="1.2" opacity="0.6" /><circle cx="8" cy="2" r="2" fill="#F04432" /></svg>
              <span>Failure ripple</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit & Explainability Modal Drawer */}
      {auditService && (
        <RiskAuditModal
          service={auditService}
          rootFailed={failed}
          onClose={() => setAuditService(null)}
        />
      )}
    </div>
  );
}
