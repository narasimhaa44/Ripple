// Service to track incident timelines, recent deployments, logs, and root-cause hypotheses
export const INCIDENT_RECORDS = {
  "svc-inventory": {
    serviceId: "svc-inventory",
    serviceName: "Inventory Service",
    status: "INVESTIGATING",
    hasIncident: true,
    startTime: "10:14 AM UTC",
    detectionTime: "10:21 AM UTC (automated synthetic health check)",
    duration: "Not independently verified; recovery time not recorded",
    recentDeployment: {
      version: "v2.14.0",
      deployedAt: "10:02 AM UTC (12 mins before outage)",
      deployer: "commerce-release-bot",
      commit: "f89a2b1 - db connection pool refactor",
      timing: "Occurred 12 minutes BEFORE failure",
    },
    configChanges: [
      {
        timestamp: "10:04 AM UTC",
        key: "max_connections",
        previous: "50",
        current: "10",
        configMap: "inventory-db-config",
      },
    ],
    logsAndAlerts: [
      {
        timestamp: "10:14:02 UTC",
        level: "ERROR",
        source: "Inventory DB",
        message: "Connection pool exhausted: 10/10 active connections timed out.",
      },
      {
        timestamp: "10:15:30 UTC",
        level: "CRITICAL",
        source: "Inventory Service",
        message: "Health check failed: HTTP 503 Service Unavailable on /healthz.",
      },
      {
        timestamp: "10:16:11 UTC",
        level: "ALERT",
        source: "Order Service",
        message: "Timeout calling inventory-service:8080/v1/stock/reserve (elapsed 5002ms).",
      },
    ],
    rootCause: {
      status: "HYPOTHESIS",
      description:
        "Connection pool exhaustion triggered by deployment v2.14.0 reducing max connections under live checkout traffic.",
    },
  },
  "svc-payment": {
    serviceId: "svc-payment",
    serviceName: "Payment Service",
    status: "CONFIRMED_OUTAGE",
    hasIncident: true,
    startTime: "09:42 AM UTC",
    detectionTime: "09:45 AM UTC (p99 latency breach)",
    duration: "~18 minutes down",
    recentDeployment: {
      version: "v4.2.1",
      deployedAt: "09:35 AM UTC (7 mins before failure)",
      deployer: "platform-infra-pipeline",
      commit: "7c31d8e - rotate internal payment gateway credentials",
      timing: "Occurred 7 minutes BEFORE failure",
    },
    configChanges: [
      {
        timestamp: "09:36 AM UTC",
        key: "gateway_tls_cert",
        previous: "gw-cert-2025",
        current: "gw-cert-2026-v2",
        configMap: "payment-ingress-tls",
      },
    ],
    logsAndAlerts: [
      {
        timestamp: "09:42:15 UTC",
        level: "ERROR",
        source: "Payment Service",
        message: "TLS handshake failure: upstream certificate verification mismatch on payment gateway ingress.",
      },
      {
        timestamp: "09:44:00 UTC",
        level: "ALERT",
        source: "Payment API",
        message: "Elevated 5xx error rate 94% on /v1/charge.",
      },
    ],
    rootCause: {
      status: "CONFIRMED",
      description:
        "Upstream TLS handshake credential mismatch post-rotation on gateway-ingress.",
    },
  },
};

export function getIncidentData(serviceId) {
  if (!serviceId) return null;
  const normalizedId = serviceId.trim().toLowerCase();
  
  if (INCIDENT_RECORDS[normalizedId]) {
    return INCIDENT_RECORDS[normalizedId];
  }

  // Fallback for services without recorded incidents
  return {
    serviceId,
    serviceName: serviceId,
    status: "HEALTHY_OR_UNTRACKED",
    hasIncident: false,
    startTime: "Not available in current incident records",
    detectionTime: "No active alert detected",
    duration: "None (operating or no outage telemetry)",
    recentDeployment: null,
    configChanges: [],
    logsAndAlerts: [],
    rootCause: {
      status: "NOT_ESTABLISHED",
      description: "No incident or root cause recorded in telemetry.",
    },
  };
}

export function searchIncidents(serviceId) {
  return getIncidentData(serviceId);
}
