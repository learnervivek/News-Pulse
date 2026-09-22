// components/ClusterDetail.js
//
// The panel that appears when you click a cluster on the timeline.
// It lists every article in that cluster, oldest first.

function formatDateTime(isoString) {
  if (!isoString) return "unknown time";
  return new Date(isoString).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClusterDetail({
  cluster,
  isLoading,
  selectedSources,
  onClose,
}) {
  if (isLoading) {
    return (
      <aside className="detail">
        <p className="empty">Loading cluster...</p>
      </aside>
    );
  }

  if (!cluster) {
    return (
      <aside className="detail">
        <p className="empty">Click a bar on the timeline to see its articles.</p>
      </aside>
    );
  }

  // Respect the source filter here too, so unticking a source really
  // does hide that outlet's articles everywhere.
  const articles = cluster.articles.filter((article) =>
    selectedSources.includes(article.source)
  );

  return (
    <aside className="detail">
      <div className="detail-header">
        <h2>{cluster.label}</h2>
        <button className="close-button" onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      <p className="detail-meta">
        {articles.length} of {cluster.articleCount} articles &middot;{" "}
        {formatDateTime(cluster.startTime)} &rarr; {formatDateTime(cluster.endTime)}
      </p>

      <ul className="article-list">
        {articles.map((article) => (
          <li key={article.id} className="article">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              {article.title}
            </a>
            <p className="article-meta">
              {article.source} &middot; {formatDateTime(article.publishedAt)}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
