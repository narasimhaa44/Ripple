import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Header from "../components/Header";
import AgentPanel from "../components/AgentPanel";
import GraphPanel from "../components/GraphPanel";
import ImpactPropagationPanel from "../components/ImpactPropagationPanel";
import { getHealth, getGraph, getImpact, askRipple } from "../services/api";
import { Database, GitBranch, Layers } from "lucide-react";

export default function DashboardPage() {
  const [health, setHealth] = useState({ status: "checking", falkordb: "checking" });
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [viewMode, setViewMode] = useState("service");
  const [activeImpact, setActiveImpact] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedHops, setSelectedHops] = useState(5);
  const [viewTab, setViewTab] = useState("graph"); // "graph" | "propagation" | "split"
  const [animationStep, setAnimationStep] = useState(null);
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);
  const seedFiredRef = useRef(false);

  const affected = activeImpact?.affectedServices || [];
  const maxSteps = useMemo(() => {
    if (!affected || affected.length === 0) return 0;
    const hopsArr = affected.map((s) => Number(s.hops) || 1);
    return Math.max(...hopsArr);
  }, [affected]);

  // Synchronized animation step timer
  useEffect(() => {
    let timer;
    if (isPlayingAnimation) {
      if (typeof animationStep !== "number") {
        setAnimationStep(0);
      } else if (animationStep < maxSteps) {
        timer = setTimeout(() => {
          setAnimationStep((prev) => ((typeof prev === "number" ? prev : 0) + 1));
        }, 850);
      } else {
        setIsPlayingAnimation(false);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlayingAnimation, animationStep, maxSteps]);

  const handlePlayAnimation = () => {
    if (typeof animationStep !== "number" || animationStep >= maxSteps) {
      setAnimationStep(0);
    }
    setIsPlayingAnimation(true);
  };

  const handlePauseAnimation = () => {
    setIsPlayingAnimation(false);
  };

  const handleResetAnimation = () => {
    setIsPlayingAnimation(false);
    setAnimationStep(0);
  };

  const handleStepForward = () => {
    setIsPlayingAnimation(false);
    setAnimationStep((prev) => {
      const current = typeof prev === "number" ? prev : 0;
      return Math.min(maxSteps, current + 1);
    });
  };

  const handleStepBackward = () => {
    setIsPlayingAnimation(false);
    setAnimationStep((prev) => {
      const current = typeof prev === "number" ? prev : 0;
      return Math.max(0, current - 1);
    });
  };

  // Load backend health
  const checkHealthStatus = useCallback(async () => {
    const h = await getHealth();
    setHealth(h);
  }, []);

  // Load graph data from FalkorDB
  const fetchGraphData = useCallback(async (mode) => {
    setIsGraphLoading(true);
    try {
      const data = await getGraph(mode || "service");
      setGraphData(data);
    } catch (err) {
      console.error("Failed to load graph:", err);
    } finally {
      setIsGraphLoading(false);
    }
  }, []);

  // Initial load - runs once
  useEffect(() => {
    checkHealthStatus();
    fetchGraphData("service");

    // Preload initial impact for svc-inventory to show active graph state
    getImpact("svc-inventory", 5)
      .then((data) => setActiveImpact(data))
      .catch((err) => console.warn("Could not preload inventory impact:", err));

    // Auto-seed chat with a real API call on first mount
    if (!seedFiredRef.current) {
      seedFiredRef.current = true;
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const seedQuestion =
        "Inventory Service went down. When did it happen, what caused it, and what else is affected?";

      setMessages([{ role: "user", content: seedQuestion, time: now }]);
      setIsLoading(true);

      askRipple(seedQuestion)
        .then((response) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content: response.answer || "No response.",
              toolsUsed: response.toolsUsed || [],
              toolTraces: response.toolTraces || [],
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          if (response.impact) {
            setActiveImpact(response.impact);
            setAnimationStep(0);
            setIsPlayingAnimation(true);
          }
        })
        .catch(() => {
          // silently fail - user can ask again
        })
        .finally(() => setIsLoading(false));
    }

    const interval = setInterval(checkHealthStatus, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle View Mode switch
  const handleChangeViewMode = (newMode) => {
    setViewMode(newMode);
    fetchGraphData(newMode);
  };

  // Handle Question Submit
  const handleSendMessage = async (question) => {
    setError(null);
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, time: now },
    ]);

    setIsLoading(true);

    try {
      const response = await askRipple(question);

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: response.answer || "No response provided.",
          toolsUsed: response.toolsUsed || [],
          toolTraces: response.toolTraces || [],
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      if (response.impact) {
        setActiveImpact(response.impact);
        setAnimationStep(0);
        setIsPlayingAnimation(true);
      }
    } catch (err) {
      console.error("Agent error:", err);
      setError(err.message || "Failed to get answer from Ripple.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Click on a node in Graph to investigate
  const handleInvestigateService = async (serviceNode) => {
    const question = `What happens if ${serviceNode.name || serviceNode.label} fails? Explain the ripple effect.`;
    setError(null);
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, time: now },
    ]);

    setIsLoading(true);

    try {
      const response = await askRipple(question, serviceNode.id);

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: response.answer || "No response provided.",
          toolsUsed: response.toolsUsed || [],
          toolTraces: response.toolTraces || [],
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      if (response.impact) {
        setActiveImpact(response.impact);
      } else {
        const directImpact = await getImpact(serviceNode.id, selectedHops);
        setActiveImpact(directImpact);
      }
      setAnimationStep(0);
      setIsPlayingAnimation(true);
    } catch (err) {
      console.error("Investigation error:", err);
      setError(err.message || "Failed to investigate service.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleHopChange = async (hops) => {
    setSelectedHops(hops);
    const serviceId = activeImpact?.failedService?.id || "svc-inventory";
    try {
      const updatedImpact = await getImpact(serviceId, hops);
      setActiveImpact(updatedImpact);
      setAnimationStep(0);
      setIsPlayingAnimation(true);
    } catch (err) {
      console.error("Failed to update hop impact:", err);
    }
  };

  const handleResetImpact = () => {
    setActiveImpact(null);
    setSelectedNode(null);
    setAnimationStep(null);
    setIsPlayingAnimation(false);
    setSelectedHops(5);
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        {/* Header */}
        <Header health={health} onRefreshHealth={checkHealthStatus} />

        {/* 2-Column Main Dashboard Grid */}
        <main className="dashboard-grid">
          {/* Left Column: Ripple Agent (Panel A) */}
          <AgentPanel
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSendMessage={handleSendMessage}
          />

          {/* Right Column: Database Graph & Impact Propagation */}
          <div className="right-column single-mode">
            {/* View Mode Tab Bar */}
            <div className="right-column-tabbar">
              <div className="tab-pill-group">
                <button
                  type="button"
                  className={`tab-btn ${viewTab === "graph" ? "active" : ""}`}
                  onClick={() => setViewTab("graph")}
                  title="Show FalkorDB Database Graph"
                >
                  <Database size={13} />
                  <span>Graph DB</span>
                </button>

                <button
                  type="button"
                  className={`tab-btn ${viewTab === "propagation" ? "active" : ""}`}
                  onClick={() => setViewTab("propagation")}
                  title="Show Impact Propagation & Risk Scoring"
                >
                  <GitBranch size={13} />
                  <span>Impact Propagation</span>
                  {activeImpact?.affectedServices?.length > 0 && (
                    <span className="tab-counter-badge">
                      {activeImpact.affectedServices.length}
                    </span>
                  )}
                </button>
              </div>

              {activeImpact?.failedService && (
                <div className="live-ripple-indicator">
                  <span className="pulse-indicator-dot" />
                  <span>Active Failure: <strong>{activeImpact.failedService.name}</strong></span>
                </div>
              )}
            </div>

            {/* Panel B: FalkorDB Database Graph */}
            {viewTab === "graph" && (
              <GraphPanel
                graphData={graphData}
                activeImpact={activeImpact}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                viewMode={viewMode}
                onChangeViewMode={handleChangeViewMode}
                onRefreshGraph={() => fetchGraphData(viewMode)}
                onInvestigateService={handleInvestigateService}
                isLoading={isGraphLoading}
                animationStep={animationStep}
                isPlaying={isPlayingAnimation}
                onPlayAnimation={handlePlayAnimation}
                onPauseAnimation={handlePauseAnimation}
                onResetAnimation={handleResetAnimation}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                selectedHops={selectedHops}
                onHopChange={handleHopChange}
              />
            )}

            {/* Panel C: Impact Propagation */}
            {viewTab === "propagation" && (
              <ImpactPropagationPanel
                activeImpact={activeImpact}
                selectedHops={selectedHops}
                onHopChange={handleHopChange}
                onReset={handleResetAnimation}
                onStepChange={setAnimationStep}
                animationStep={animationStep}
                isPlaying={isPlayingAnimation}
                onPlayAnimation={handlePlayAnimation}
                onPauseAnimation={handlePauseAnimation}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

