import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--page)",
        color: "var(--text)",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: "var(--panel-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          color: "var(--muted)",
        }}
      >
        <Compass size={32} />
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>404 — Page Not Found</h1>
      <p style={{ color: "var(--muted)", maxWidth: 400, marginBottom: 24 }}>
        The page you are looking for does not exist in Ripple.
      </p>
      <Link
        to="/"
        className="btn-primary"
        style={{ textDecoration: "none" }}
      >
        <ArrowLeft size={16} />
        <span>Return to Ripple Dashboard</span>
      </Link>
    </div>
  );
}
