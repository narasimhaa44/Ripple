import React, { useState, useRef, useEffect } from "react";
import { Search, ArrowRight, User, CheckCircle2, ChevronDown, ChevronUp, AlertCircle, Loader2 } from "lucide-react";
import { renderFormattedContent } from "../utils/formatMarkdown";

function ToolsCard({ toolsUsed = [], toolTraces = [] }) {
  const [open, setOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);

  const count = toolTraces.length || toolsUsed.length;

  return (
    <div className="tools-card">
      <div
        className="tools-card-header"
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Tools & Algorithm Traces ({count})</span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {open && (
        <div className="tools-list">
          {toolTraces.length > 0
            ? toolTraces.map((trace, tIdx) => {
                const isItemExpanded = expandedIndex === tIdx;
                return (
                  <div
                    key={tIdx}
                    className="tool-item"
                    style={{ flexDirection: "column", alignItems: "flex-start", cursor: "pointer", gap: 4 }}
                    onClick={() => setExpandedIndex(isItemExpanded ? null : tIdx)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                      <CheckCircle2 size={13} color="var(--green)" />
                      <strong style={{ fontSize: 12, color: "var(--text)" }}>{trace.name}</strong>
                      <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
                        {trace.summary || "Completed"}
                      </span>
                    </div>
                    {isItemExpanded && (
                      <div
                        style={{
                          width: "100%",
                          marginTop: 4,
                          padding: "6px 8px",
                          backgroundColor: "var(--panel)",
                          borderRadius: 6,
                          fontSize: 11,
                          fontFamily: "ui-monospace, monospace",
                          color: "var(--text)",
                          border: "1px solid var(--border-light)",
                        }}
                      >
                        <div><strong>Args:</strong> {JSON.stringify(trace.args || {})}</div>
                        <div style={{ marginTop: 2 }}><strong>Result:</strong> {trace.summary}</div>
                      </div>
                    )}
                  </div>
                );
              })
            : toolsUsed.map((tool, tIdx) => (
                <div key={tIdx} className="tool-item">
                  <CheckCircle2 size={13} />
                  <span>{tool}</span>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

export default function AgentPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
}) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handlePromptClick = (question) => {
    if (isLoading) return;
    onSendMessage(question);
  };

  return (
    <div className="panel agent-panel">
      <div className="panel-header">
        <div className="panel-title-area">
          <h2 className="panel-title">Ripple Agent</h2>
        </div>
        <div className="agent-status-pill">
          <span className="status-dot" />
          <span>AGENT READY</span>
        </div>
      </div>

      <div className="agent-intro-text">
        Ask questions about service failures and get graph-backed answers.
      </div>

      <div className="agent-messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-bubble ${msg.role} animate-fade-in`}>
            {msg.role === "user" ? (
              <>
                <div className="bubble-avatar user-av">
                  <User size={18} />
                </div>
                <div className="bubble-content-card">
                  <div>{msg.content}</div>
                  <div className="bubble-timestamp">{msg.time || "Just now"}</div>
                </div>
              </>
            ) : (
              <>
                <div className="bubble-avatar agent-av">
                  <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
                    <path
                      d="M10 10L26 26M26 10L10 26"
                      stroke="#507CA6"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <circle cx="10" cy="10" r="4.5" fill="#507CA6" />
                    <circle cx="26" cy="10" r="4.5" fill="#507CA6" />
                    <circle cx="10" cy="26" r="4.5" fill="#507CA6" />
                    <circle cx="26" cy="26" r="4.5" fill="#507CA6" />
                  </svg>
                </div>
                <div className="bubble-content-card">
                  <div className="agent-markdown">
                    {renderFormattedContent(msg.content, onSendMessage)}
                  </div>

                  {/* Per-message collapsible tools card */}
                  {((Array.isArray(msg.toolsUsed) && msg.toolsUsed.length > 0) ||
                    (Array.isArray(msg.toolTraces) && msg.toolTraces.length > 0)) && (
                    <ToolsCard toolsUsed={msg.toolsUsed} toolTraces={msg.toolTraces} />
                  )}

                  <div className="bubble-timestamp">{msg.time || "Just now"}</div>
                </div>
              </>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="chat-bubble agent animate-fade-in">
            <div className="bubble-avatar agent-av">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <div className="bubble-content-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Investigating system dependency graph with FalkorDB...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-bubble agent animate-fade-in">
            <div className="bubble-avatar" style={{ background: "var(--red-light)", color: "var(--red)" }}>
              <AlertCircle size={18} />
            </div>
            <div
              className="bubble-content-card"
              style={{
                borderColor: "var(--red-border)",
                background: "var(--red-light)",
                color: "var(--red)",
              }}
            >
              <strong>Investigation Error:</strong> {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="agent-input-container">
        <form onSubmit={handleSubmit} className="input-box-wrapper">
          <Search size={16} color="var(--muted)" style={{ marginLeft: 4 }} />
          <input
            type="text"
            className="input-field"
            placeholder="Ask anything about a service..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={!inputText.trim() || isLoading}
            aria-label="Send question"
          >
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="prompt-chips-group">
          <button
            type="button"
            className="prompt-chip"
            onClick={() => handlePromptClick("What happens if Inventory Service fails? Explain the ripple effect.")}
          >
            Inventory failure
          </button>
          <button
            type="button"
            className="prompt-chip"
            onClick={() => handlePromptClick("What happens if Payment Service fails?")}
          >
            Payments down
          </button>
          <button
            type="button"
            className="prompt-chip"
            onClick={() => handlePromptClick("Explain the path to Shipping Service.")}
          >
            Explain a path
          </button>
          <button
            type="button"
            className="prompt-chip"
            style={{ fontWeight: 600, borderColor: "var(--blue)" }}
            onClick={() => handlePromptClick("How does Ripple fulfill the Track 1 requirements?")}
          >
            Track 1 Requirements
          </button>
        </div>
      </div>
    </div>
  );
}
