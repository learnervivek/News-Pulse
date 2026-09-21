// lib/api.js
//
// One small place that knows how to talk to the backend API.
// Every component calls these functions instead of writing fetch()
// calls of its own, so the API address only appears once.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error || `Request failed (${response.status})`);
  }

  return response.json();
}

// `days` controls how far back the timeline looks (the backend
// defaults to 7 days if we don't pass anything).
export function getTimeline(days) {
  return request(`/timeline?days=${days}`);
}

export function getSources() {
  return request("/sources");
}

export function getCluster(id) {
  return request(`/clusters/${id}`);
}

export function triggerIngest() {
  return request("/ingest/trigger", { method: "POST" });
}

export function getIngestStatus(jobId) {
  return request(`/ingest/status/${jobId}`);
}
