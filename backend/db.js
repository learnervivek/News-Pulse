// db.js
//
// Opens the same SQLite file that the Python scraper writes to, and
// provides small helper functions for every query the API needs.
// All SQL lives in this one file so the route files stay easy to read.

const path = require("path");
const Database = require("better-sqlite3");

// Where the database file lives. Configured through an environment
// variable so nothing is hard-coded (required by the assessment).
const dbPath = path.resolve(__dirname, process.env.DB_PATH || "../news_pulse.db");

const db = new Database(dbPath);

/**
 * Every cluster with its article count and the time range it covers
 * (earliest article -> latest article).
 */
function getClusters() {
  return db
    .prepare(
      `SELECT
         clusters.id,
         clusters.label,
         COUNT(articles.id)        AS articleCount,
         MIN(articles.published_at) AS startTime,
         MAX(articles.published_at) AS endTime
       FROM clusters
       LEFT JOIN articles ON articles.cluster_id = clusters.id
       GROUP BY clusters.id
       HAVING articleCount > 0
       ORDER BY articleCount DESC`
    )
    .all();
}

/** One cluster by id, or undefined if it doesn't exist. */
function getClusterById(id) {
  return db
    .prepare(
      `SELECT
         clusters.id,
         clusters.label,
         COUNT(articles.id)         AS articleCount,
         MIN(articles.published_at) AS startTime,
         MAX(articles.published_at) AS endTime
       FROM clusters
       LEFT JOIN articles ON articles.cluster_id = clusters.id
       WHERE clusters.id = ?
       GROUP BY clusters.id`
    )
    .get(id);
}

/** All articles inside one cluster, oldest first. */
function getArticlesByCluster(clusterId) {
  return db
    .prepare(
      `SELECT id, source, title, url, summary, published_at AS publishedAt
       FROM articles
       WHERE cluster_id = ?
       ORDER BY published_at ASC`
    )
    .all(clusterId);
}

/** The distinct list of news sources we have articles from. */
function getSources() {
  const rows = db
    .prepare(`SELECT DISTINCT source FROM articles ORDER BY source ASC`)
    .all();
  return rows.map((row) => row.source);
}

/**
 * Which sources contributed to each cluster. The frontend uses this to
 * filter the timeline by source.
 */
function getClusterSources(clusterId) {
  const rows = db
    .prepare(
      `SELECT DISTINCT source FROM articles WHERE cluster_id = ? ORDER BY source ASC`
    )
    .all(clusterId);
  return rows.map((row) => row.source);
}

module.exports = {
  getClusters,
  getClusterById,
  getArticlesByCluster,
  getSources,
  getClusterSources,
};
