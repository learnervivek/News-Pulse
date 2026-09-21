// routes/clusters.js
//
// Endpoints:
//   GET /clusters      -> list of all topic clusters
//   GET /clusters/:id  -> one cluster with all of its articles

const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /clusters
// Returns every cluster with its label, how many articles it holds,
// and the time range those articles span.
router.get("/", (req, res) => {
  const clusters = db.getClusters().map((cluster) => ({
    ...cluster,
    sources: db.getClusterSources(cluster.id),
  }));

  res.json({ count: clusters.length, clusters });
});

// GET /clusters/:id
// Returns one cluster plus all its articles, sorted oldest -> newest.
router.get("/:id", (req, res) => {
  const clusterId = Number(req.params.id);

  // Validate the input before touching the database.
  if (!Number.isInteger(clusterId) || clusterId <= 0) {
    return res.status(400).json({ error: "Cluster id must be a positive number" });
  }

  const cluster = db.getClusterById(clusterId);
  if (!cluster) {
    return res.status(404).json({ error: `No cluster found with id ${clusterId}` });
  }

  res.json({
    ...cluster,
    sources: db.getClusterSources(clusterId),
    articles: db.getArticlesByCluster(clusterId),
  });
});

module.exports = router;
