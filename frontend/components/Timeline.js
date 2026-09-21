// components/Timeline.js
//
// The timeline itself, drawn Gantt-chart style: every topic cluster gets
// a row, with its name on the left and a bar on the right that stretches
// from the cluster's earliest article to its latest one. So you can see
// at a glance "this topic was active during this window".
//
// It is built by hand with plain CSS (no charting library). The only
// maths involved is "where does this timestamp sit between the start and
// the end of the whole window, as a percentage".

function toMilliseconds(isoString) {
  return new Date(isoString).getTime();
}

const TWO_DAYS_IN_MS = 2 * 24 * 60 * 60 * 1000;

function formatTick(date, windowLength) {
  // When the whole timeline covers a day or two, every tick would repeat
  // the same date - so we only show the clock time and keep it readable.
  if (windowLength <= TWO_DAYS_IN_MS) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Timeline({
  items,
  rangeStart,
  rangeEnd,
  selectedClusterId,
  onSelectCluster,
}) {
  if (!items.length) {
    return <p className="empty">No clusters match the current filters.</p>;
  }

  const windowStart = toMilliseconds(rangeStart);
  const windowEnd = toMilliseconds(rangeEnd);
  const windowLength = Math.max(windowEnd - windowStart, 1); // never divide by 0

  // Turn a timestamp into a left-offset percentage across the track.
  function positionPercent(isoString) {
    return ((toMilliseconds(isoString) - windowStart) / windowLength) * 100;
  }

  // Five evenly spaced labels along the time axis.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    percent: fraction * 100,
    label: formatTick(new Date(windowStart + windowLength * fraction), windowLength),
  }));

  // The date range is shown once above the chart instead of on every tick.
  const rangeCaption = `${new Date(windowStart).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })} - ${new Date(windowEnd).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })}`;

  // Busiest topics first - those are the ones worth looking at.
  const sortedItems = [...items].sort(
    (a, b) =>
      b.articleCount - a.articleCount ||
      toMilliseconds(a.start) - toMilliseconds(b.start)
  );

  return (
    <div className="timeline">
      <p className="range-caption">{rangeCaption}</p>

      <div className="timeline-row timeline-axis">
        <div className="row-label" />
        <div className="axis-track">
          {ticks.map((tick) => (
            <span
              key={tick.percent}
              className="axis-label"
              style={{ left: `${tick.percent}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>

      <div className="timeline-rows">
        {sortedItems.map((cluster) => {
          const left = positionPercent(cluster.start);
          const right = positionPercent(cluster.end);
          // Clusters with one article have start === end, which would be
          // an invisible zero-width bar - so every bar gets a minimum.
          const width = Math.max(right - left, 0.8);
          const isSelected = cluster.id === selectedClusterId;

          return (
            <div
              key={cluster.id}
              className={isSelected ? "timeline-row row-selected" : "timeline-row"}
            >
              <button
                className="row-label row-label-button"
                onClick={() => onSelectCluster(cluster.id)}
                title={cluster.label}
              >
                {cluster.label}
              </button>

              <div className="row-track">
                <button
                  className={isSelected ? "bar bar-selected" : "bar"}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    // Bigger cluster = taller, bolder bar.
                    height: `${10 + cluster.intensity * 12}px`,
                    opacity: 0.6 + cluster.intensity * 0.4,
                  }}
                  onClick={() => onSelectCluster(cluster.id)}
                  title={`${cluster.label} - ${cluster.articleCount} articles`}
                />
                <span className="row-count">{cluster.articleCount}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
