// pages/index.js
//
// The one page of the app. It holds all the state (timeline data,
// which sources are ticked, which cluster is open) and passes it down
// to the small components in /components.

import { useState, useEffect } from "react";

import Timeline from "../components/Timeline";
import ClusterDetail from "../components/ClusterDetail";
import SourceFilter from "../components/SourceFilter";
import {
  getTimeline,
  getSources,
  getCluster,
  triggerIngest,
  getIngestStatus,
} from "../lib/api";

// Small helper so we can "wait 2 seconds" inside an async function.
function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default function HomePage() {
  const [timeline, setTimeline] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);

  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [clusterDetail, setClusterDetail] = useState(null);
  const [isLoadingCluster, setIsLoadingCluster] = useState(false);

  const [days, setDays] = useState(7);
  // Most clusters contain a single article (one outlet covering a story
  // nobody else picked up). Hiding them by default keeps the timeline
  // readable; the checkbox brings them back.
  const [showSingleArticleTopics, setShowSingleArticleTopics] = useState(false);
  const [status, setStatus] = useState("Loading...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState(null);

  // --- Loading data -------------------------------------------------

  async function loadData(daysToLoad = days) {
    try {
      const [timelineData, sourcesData] = await Promise.all([
        getTimeline(daysToLoad),
        getSources(),
      ]);

      setTimeline(timelineData);

      // Tick any source we hadn't seen before. On the first load that
      // means all of them; if a scrape later adds a brand new outlet it
      // shows up ticked too. Sources the user unticked stay unticked.
      const newSources = sourcesData.sources.filter(
        (source) => !sources.includes(source)
      );
      if (newSources.length > 0) {
        setSelectedSources((current) => [...current, ...newSources]);
      }
      setSources(sourcesData.sources);

      setStatus(`${timelineData.count} topic clusters`);
      setError(null);
    } catch (loadError) {
      setError(`Could not reach the API: ${loadError.message}`);
      setStatus("");
    }
  }

  // Run once when the page first opens.
  useEffect(() => {
    loadData();
  }, []);

  // Stretch goal: re-check the API every 60 seconds when auto-refresh
  // is switched on, so the timeline updates without clicking anything.
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => loadData(), 60000);
    return () => clearInterval(timer); // stop polling when switched off
  }, [autoRefresh, days]);

  // Changing the time window reloads the timeline with a new range.
  function handleChangeDays(newDays) {
    setDays(newDays);
    setStatus("Loading...");
    loadData(newDays);
  }

  // --- Refresh button -----------------------------------------------

  async function handleRefresh() {
    setIsRefreshing(true);
    setError(null);

    try {
      // 1. Ask the backend to start the Python scraper.
      const job = await triggerIngest();
      setStatus("Scraping news sources...");

      // 2. Keep checking that job until it finishes.
      let jobStatus = job.status;
      while (jobStatus === "running") {
        await wait(2500);
        const latest = await getIngestStatus(job.jobId);
        jobStatus = latest.status;
        setStatus(latest.message || "Working...");
      }

      // 3. Reload the timeline with whatever the scraper found.
      if (jobStatus === "completed") {
        await loadData();
      } else {
        setError("The scrape job failed. Check the backend logs.");
      }
    } catch (refreshError) {
      setError(refreshError.message);
    } finally {
      setIsRefreshing(false);
    }
  }

  // --- Interactions --------------------------------------------------

  async function handleSelectCluster(clusterId) {
    setSelectedClusterId(clusterId);
    setIsLoadingCluster(true);
    try {
      setClusterDetail(await getCluster(clusterId));
    } catch (clusterError) {
      setError(clusterError.message);
    } finally {
      setIsLoadingCluster(false);
    }
  }

  function handleToggleSource(source) {
    setSelectedSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source]
    );
  }

  // Keep a cluster visible if any of its articles came from a ticked
  // source (and, unless asked, only if it groups more than one article).
  const visibleItems = (timeline?.items || []).filter(
    (cluster) =>
      cluster.sources.some((source) => selectedSources.includes(source)) &&
      (showSingleArticleTopics || cluster.articleCount > 1)
  );

  return (
    <main className="page">
      <header className="header">
        <div className="brand-block">
          <div className="brand-line">
            <span className="brand-mark" aria-hidden="true">NP</span>
            <span className="eyebrow">Live news monitor</span>
          </div>
          <h1>News Pulse</h1>
          <p className="subtitle">
            Stories grouped by topic and plotted over time
          </p>
        </div>

        <div className="controls">
          <select
            className="window-select"
            value={days}
            onChange={(event) => handleChangeDays(Number(event.target.value))}
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <label className="filter-option">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
            />
            Auto-refresh
          </label>
          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </header>

      <div className="status-bar">
        <span className="status-indicator" aria-hidden="true" />
        <span>
          {status}
          {timeline ? ` - showing ${visibleItems.length}` : ""}
        </span>
        {error && <span className="error">{error}</span>}
      </div>

      <section className="overview" aria-label="Timeline overview">
        <div className="overview-item">
          <span className="overview-label">Topics</span>
          <strong>{timeline?.count ?? "-"}</strong>
        </div>
        <div className="overview-item">
          <span className="overview-label">Showing</span>
          <strong>{timeline ? visibleItems.length : "-"}</strong>
        </div>
        <div className="overview-item">
          <span className="overview-label">Sources</span>
          <strong>{sources.length || "-"}</strong>
        </div>
      </section>

      <div className="filter-row">
        <SourceFilter
          sources={sources}
          selectedSources={selectedSources}
          onToggle={handleToggleSource}
        />

        <label className="filter-option filter-box">
          <input
            type="checkbox"
            checked={showSingleArticleTopics}
            onChange={() =>
              setShowSingleArticleTopics(!showSingleArticleTopics)
            }
          />
          Show single-article topics
        </label>
      </div>

      <div className="layout">
        <section className="timeline-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Activity</p>
              <h2>Topic timeline</h2>
            </div>
            <span className="panel-note">Select a topic for details</span>
          </div>
          {timeline && timeline.rangeStart ? (
            <Timeline
              items={visibleItems}
              rangeStart={timeline.rangeStart}
              rangeEnd={timeline.rangeEnd}
              selectedClusterId={selectedClusterId}
              onSelectCluster={handleSelectCluster}
            />
          ) : (
            <p className="empty">No data yet - click &ldquo;Refresh data&rdquo;.</p>
          )}
        </section>

        <ClusterDetail
          cluster={clusterDetail}
          isLoading={isLoadingCluster}
          selectedSources={selectedSources}
          onClose={() => {
            setClusterDetail(null);
            setSelectedClusterId(null);
          }}
        />
      </div>

      <footer className="footer">
        <span>News Pulse</span>
        <span>BBC News · NPR · Al Jazeera</span>
        <span>Updated from live RSS feeds</span>
      </footer>
    </main>
  );
}
