// server.js
//
// The entry point of the API. It wires up the routes, some basic
// middleware, and the error handling - then starts listening.

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./db");
const clustersRouter = require("./routes/clusters");
const timelineRouter = require("./routes/timeline");
const ingestRouter = require("./routes/ingest");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// A tiny health check, handy for confirming a deployment is alive.
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// The list of news sources, used by the frontend's source filter.
app.get("/sources", (req, res) => {
  res.json({ sources: db.getSources() });
});

app.use("/clusters", clustersRouter);
app.use("/timeline", timelineRouter);
app.use("/ingest", ingestRouter);

// Any URL that didn't match a route above.
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// If any route throws, we end up here instead of crashing the server.
app.use((error, req, res, next) => {
  console.error("Unexpected error:", error);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`News Pulse API listening on http://localhost:${port}`);
});
