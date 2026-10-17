import React from "react";

export default function Header({ health, onRefreshHealth }) {
  const isApiConnected = health?.status === "healthy";
  const isFalkorDbConnected = health?.falkordb === "connected";

  return (
    <header className="dashboard-header">
      <div className="header-brand">
        <div className="brand-logo-wrap">
          {/* Custom Ripple Molecule Logo matching screenshot */}
          <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 10L26 26M26 10L10 26"
              stroke="#507CA6"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="10" cy="10" r="5" fill="#507CA6" />
            <circle cx="26" cy="10" r="5" fill="#507CA6" />
            <circle cx="10" cy="26" r="5" fill="#507CA6" />
            <circle cx="26" cy="26" r="5" fill="#507CA6" />
            <circle cx="18" cy="18" r="3.5" fill="#3D648B" />
          </svg>
        </div>
        <div className="brand-text-wrap">
          <span className="brand-title">Ripple</span>
          <span className="brand-subtitle">AI IMPACT INVESTIGATOR</span>
        </div>
      </div>

      <div className="header-status-group">
        <div
          className={`status-badge ${isFalkorDbConnected ? "connected" : "offline"}`}
          title={isFalkorDbConnected ? "FalkorDB graph is live and reachable" : "FalkorDB connection check failed"}
        >
          <span className={`status-dot ${isFalkorDbConnected ? "pulse" : ""}`} />
          <span>{isFalkorDbConnected ? "FalkorDB CONNECTED" : "FalkorDB OFFLINE"}</span>
        </div>

        <div
          className={`status-badge ${isApiConnected ? "connected" : "offline"}`}
          title={isApiConnected ? "Backend API is online at localhost:5000" : "Backend API unavailable"}
          onClick={onRefreshHealth}
          style={{ cursor: "pointer" }}
        >
          <span className={`status-dot ${isApiConnected ? "pulse" : ""}`} />
          <span>{isApiConnected ? "API CONNECTED" : "API OFFLINE"}</span>
        </div>
      </div>
    </header>
  );
}
