// routes/timeline.js
//
// Endpoint:
//   GET /timeline -> clusters shaped specifically for drawing a chart
//
// The difference between this and GET /clusters is the *shape*: a chart
// needs a start time, an end time and a size value per item, plus the
// overall time window it should draw an axis for. Doing that maths here
// keeps the frontend simple.

const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  // How many days back the timeline should cover. Feeds sometimes
  // include an old "explainer" article from years ago, and a single one
  // of those would stretch the axis so far that today's news gets
  // squashed into a thin sliver on the right.
  const days = Number(req.query.days ?? 7);

  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return res
      .status(400)
      .json({ error: "Query parameter 'days' must be a number between 1 and 365" });
  }

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const clusters = db.getClusters();

  // A cluster can only be plotted if we know when its articles were
  // published, so skip any cluster with missing timestamps, plus any
  // cluster whose newest article is older than the window.
  const plottable = clusters.filter(
    (c) => c.startTime && c.endTime && new Date(c.endTime).getTime() >= cutoff
  );

  // The biggest cluster becomes our "100% intensity" reference point,
  // so the frontend can size markers relative to it.
  const largestCount = plottable.reduce(
    (max, cluster) => Math.max(max, cluster.articleCount),
    0
  );

  const items = plottable.map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    start: cluster.startTime,
    end: cluster.endTime,
    articleCount: cluster.articleCount,
    // 0.0 - 1.0, where 1.0 is the busiest cluster.
    intensity: largestCount > 0 ? cluster.articleCount / largestCount : 0,
    sources: db.getClusterSources(cluster.id),
  }));

  // The axis always covers the whole requested window (e.g. the full
  // last 7 days), not just the span of the articles we happen to have.
  // That way "Last 24 hours" and "Last 30 days" look visibly different
  // even when every article was published today.
  res.json({
    rangeStart: new Date(cutoff).toISOString(),
    rangeEnd: new Date(now).toISOString(),
    days,
    count: items.length,
    items,
  });
});

module.exports = router;
