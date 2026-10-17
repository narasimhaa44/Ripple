import React from "react";
import { Clock, GitBranch, ShieldAlert, Compass, ArrowRight, CheckCircle, Layers, Cpu, Eye, Zap } from "lucide-react";

// Section icon mapping for both investigation AND track-1 sections
const SECTION_PATTERNS = [
  {
    test: (t) => /failure timeline|1\.\s*failure timeline/i.test(t),
    icon: <Clock size={15} color="var(--orange)" />,
    label: "Failure Timeline",
  },
  {
    test: (t) => /impact identified|2\.\s*impact identified/i.test(t),
    icon: <GitBranch size={15} color="var(--red)" />,
    label: "Impact Identified from Graph",
  },
  {
    test: (t) => /evidence path|3\.\s*evidence path/i.test(t),
    icon: <ShieldAlert size={15} color="var(--blue)" />,
    label: "Evidence Path & Support",
  },
  {
    test: (t) => /recommended|4\.\s*recommended/i.test(t),
    icon: <Compass size={15} color="var(--green)" />,
    label: "Recommended Investigation Steps",
  },
  // Track 1 sections
  {
    test: (t) => /multi.hop reasoning|1\.\s*multi.hop/i.test(t),
    icon: <Layers size={15} color="var(--blue)" />,
    label: null, // Use text from line
  },
  {
    test: (t) => /graph queries|2\.\s*graph queries/i.test(t),
    icon: <GitBranch size={15} color="var(--orange)" />,
    label: null,
  },
  {
    test: (t) => /tool selection|mcp|3\.\s*tool/i.test(t),
    icon: <Cpu size={15} color="var(--blue)" />,
    label: null,
  },
  {
    test: (t) => /actions based|4\.\s*actions/i.test(t),
    icon: <Zap size={15} color="var(--orange)" />,
    label: null,
  },
  {
    test: (t) => /explainable results|5\.\s*explainable/i.test(t),
    icon: <Eye size={15} color="var(--green)" />,
    label: null,
  },
];

export function renderFormattedContent(text, onFollowUpClick) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let inTable = false;
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1).filter((r) => !r.every((c) => /^-+$/.test(c.trim())));

      elements.push(
        <div key={`table-${elements.length}`} style={{ overflowX: "auto", margin: "10px 0" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
              backgroundColor: "var(--panel)",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "var(--panel-muted)" }}>
                {header.map((col, idx) => (
                  <th
                    key={idx}
                    style={{
                      padding: "6px 10px",
                      border: "1px solid var(--border-light)",
                      textAlign: "left",
                      fontWeight: 700,
                    }}
                  >
                    {formatInline(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: "5px 10px",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    // Evidence Status pill
    if (trimmed.toLowerCase().includes("evidence status:")) {
      const isConfirmed = trimmed.toLowerCase().includes("confirmed");
      elements.push(
        <div
          key={index}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 8,
            backgroundColor: isConfirmed ? "var(--green-light)" : "var(--orange-light)",
            border: `1px solid ${isConfirmed ? "var(--green-border)" : "var(--orange-border)"}`,
            color: isConfirmed ? "var(--green)" : "var(--orange)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "currentColor" }} />
          <span>{isConfirmed ? "Confirmed Telemetry & Graph Evidence" : "Partial Evidence (Graph Modeled)"}</span>
        </div>
      );
      return;
    }

    // Interactive Follow-up Question
    if (trimmed.startsWith("*") && trimmed.endsWith("*") && trimmed.includes("?")) {
      const promptText = trimmed.replace(/^\*|\*$/g, "");
      elements.push(
        <div
          key={index}
          style={{
            marginTop: 10,
            padding: "10px 14px",
            backgroundColor: "var(--panel)",
            borderRadius: "8px",
            border: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
            {promptText}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button
              type="button"
              className="prompt-chip"
              style={{ fontSize: "11px", padding: "4px 10px", backgroundColor: "var(--panel-muted)" }}
              onClick={() => onFollowUpClick && onFollowUpClick("When was the first failure time and what did the health check report?")}
            >
              Investigate first failure time
            </button>
            <button
              type="button"
              className="prompt-chip"
              style={{ fontSize: "11px", padding: "4px 10px", backgroundColor: "var(--panel-muted)" }}
              onClick={() => onFollowUpClick && onFollowUpClick("What recent deployments or configuration changes occurred before the outage?")}
            >
              Inspect recent deployment
            </button>
          </div>
        </div>
      );
      return;
    }

    // Section headings: ### or ## — check against our pattern list
    if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
      const headingText = trimmed.replace(/^#{2,3}\s+/, "");

      // Check for a matching section pattern
      const matched = SECTION_PATTERNS.find((p) => p.test(headingText));
      if (matched) {
        elements.push(
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginTop: 12,
              marginBottom: 6,
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "Space Grotesk, sans-serif",
            }}
          >
            {matched.icon}
            <span>{matched.label || headingText}</span>
          </div>
        );
        return;
      }

      // Default heading rendering
      elements.push(
        <h4
          key={index}
          style={{
            fontSize: "13.5px",
            fontWeight: 700,
            marginTop: "10px",
            marginBottom: "4px",
            color: "var(--text)",
          }}
        >
          {formatInline(headingText)}
        </h4>
      );
      return;
    }

    // Bullet points
    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.replace(/^[•\-\*]\s+/, "");
      elements.push(
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 7,
            marginLeft: 2,
            marginBottom: 4,
            fontSize: "12.5px",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: "var(--muted)", fontWeight: 700, marginTop: 1 }}>•</span>
          <div>{formatInline(content)}</div>
        </div>
      );
      return;
    }

    // Numbered list items (e.g. "1. Something")
    if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const [, num, content] = numMatch;
        elements.push(
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginLeft: 2,
              marginBottom: 4,
              fontSize: "12.5px",
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                minWidth: 18,
                height: 18,
                borderRadius: 4,
                backgroundColor: "var(--panel-muted)",
                border: "1px solid var(--border-light)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted)",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {num}
            </span>
            <div>{formatInline(content)}</div>
          </div>
        );
        return;
      }
    }

    // Regular line or empty
    if (!trimmed) {
      elements.push(<div key={index} style={{ height: 4 }} />);
    } else {
      elements.push(
        <div key={index} style={{ marginBottom: 4, fontSize: "13px", lineHeight: 1.5 }}>
          {formatInline(line)}
        </div>
      );
    }
  });

  if (inTable) {
    flushTable();
  }

  return elements;
}

function formatInline(text) {
  if (!text) return "";

  // Process inline code first: `code`
  const codeSegments = text.split(/(`[^`]+`)/g);
  
  const renderedSegments = codeSegments.map((segment, segIdx) => {
    if (segment.startsWith("`") && segment.endsWith("`") && segment.length > 2) {
      const codeText = segment.slice(1, -1);
      return (
        <code
          key={segIdx}
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "11px",
            backgroundColor: "var(--panel-muted)",
            border: "1px solid var(--border-light)",
            borderRadius: "4px",
            padding: "1px 5px",
            color: "var(--blue)",
            wordBreak: "break-all",
          }}
        >
          {codeText}
        </code>
      );
    }

    // Split on bold syntax: **text**
    const parts = segment.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const content = part.slice(2, -2);
        return (
          <strong key={`${segIdx}-${i}`} style={{ fontWeight: 700, color: "var(--text)" }}>
            {content}
          </strong>
        );
      }

      // Highlight severities: [CRITICAL], [HIGH], [MEDIUM], [LOW]
      if (/\[(CRITICAL|HIGH|MEDIUM|LOW)\]/i.test(part)) {
        return (
          <span
            key={`${segIdx}-${i}`}
            className={`severity-pill ${part.replace(/[\[\]]/g, "").toLowerCase()}`}
            style={{ fontSize: "10px", padding: "1px 6px", margin: "0 3px" }}
          >
            {part.replace(/[\[\]]/g, "")}
          </span>
        );
      }

      // Highlight [HYPOTHESIS] or [CONFIRMED]
      if (/\[(HYPOTHESIS|CONFIRMED|PARTIAL)\]/i.test(part)) {
        const status = part.replace(/[\[\]]/g, "");
        const isHypothesis = status === "HYPOTHESIS";
        return (
          <span
            key={`${segIdx}-${i}`}
            style={{
              fontSize: "10px",
              padding: "1px 6px",
              margin: "0 3px",
              borderRadius: "4px",
              fontWeight: 700,
              backgroundColor: isHypothesis ? "var(--orange-light)" : "var(--green-light)",
              color: isHypothesis ? "var(--orange)" : "var(--green)",
              border: `1px solid ${isHypothesis ? "var(--orange-border)" : "var(--green-border)"}`,
            }}
          >
            {status}
          </span>
        );
      }

      return part;
    });
  });

  return renderedSegments;
}
