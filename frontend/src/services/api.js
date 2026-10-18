const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://ripple-backend-fu1d.onrender.com";

export async function getHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      return { status: "offline", service: "ripple-backend", falkordb: "disconnected" };
    }
    return await response.json();
  } catch (error) {
    return { status: "offline", service: "ripple-backend", falkordb: "disconnected", error: error.message };
  }
}

export async function getGraph(view = "service") {
  const response = await fetch(`${API_BASE_URL}/api/graph?view=${encodeURIComponent(view)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to load FalkorDB graph data.");
  }
  return data;
}

export async function getImpact(serviceId, maxHops = 5) {
  const query = maxHops ? `?maxHops=${encodeURIComponent(maxHops)}` : "";
  const response = await fetch(
    `${API_BASE_URL}/api/impact/${encodeURIComponent(serviceId)}${query}`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Impact analysis failed.");
  }
  return data;
}

export async function askRipple(question, serviceId) {
  const response = await fetch(`${API_BASE_URL}/api/agent/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      ...(serviceId ? { serviceId } : {}),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Ripple could not answer your question.");
  }
  return data;
}
