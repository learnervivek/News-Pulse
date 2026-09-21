// routes/ingest.js
//
// Endpoints:
//   POST /ingest/trigger        -> starts the Python scraper, returns a job id
//   GET  /ingest/status/:jobId  -> lets the frontend poll that job
//
// The Python pipeline can take a while (it downloads article pages), so
// we do NOT make the browser wait for it. We start it in the background
// and hand back a job id the frontend can check on.

const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const express = require("express");

const router = express.Router();

// Job records are kept in memory: jobId -> { status, startedAt, ... }.
// That is fine here because a job only matters while the page is open.
// (A production system would store these in the database instead.)
const jobs = new Map();

// Only one scrape should run at a time - two at once would just fight
// over the same database file.
let runningJobId = null;

function startScraper(jobId) {
  const scraperDir = path.resolve(__dirname, "..", process.env.SCRAPER_DIR || "../scraper");
  const script = process.env.SCRAPER_SCRIPT || "main.py";
  const pythonBin = process.env.PYTHON_BIN || "python";

  const child = spawn(pythonBin, [script], { cwd: scraperDir });

  // Remember the last thing Python printed, so a failed job can explain
  // itself instead of just saying "exit code 1".
  let lastError = "";

  child.stdout.on("data", (chunk) => {
    jobs.get(jobId).message = chunk.toString().trim().split("\n").pop();
  });

  child.stderr.on("data", (chunk) => {
    lastError = chunk.toString().trim().split("\n").pop();
  });

  child.on("error", (error) => {
    Object.assign(jobs.get(jobId), {
      status: "failed",
      message: `Could not start Python: ${error.message}`,
      finishedAt: new Date().toISOString(),
    });
    runningJobId = null;
  });

  child.on("close", (exitCode) => {
    Object.assign(jobs.get(jobId), {
      status: exitCode === 0 ? "completed" : "failed",
      message:
        exitCode === 0
          ? "Scrape finished"
          : `Scraper failed (exit code ${exitCode}): ${lastError || "no error output"}`,
      finishedAt: new Date().toISOString(),
    });
    runningJobId = null;
  });
}

// POST /ingest/trigger
router.post("/trigger", (req, res) => {
  if (runningJobId) {
    // 409 Conflict: a scrape is already in progress.
    return res.status(409).json({
      error: "A scrape is already running",
      jobId: runningJobId,
    });
  }

  const jobId = crypto.randomUUID();
  jobs.set(jobId, {
    jobId,
    status: "running",
    message: "Scraper started",
    startedAt: new Date().toISOString(),
    finishedAt: null,
  });
  runningJobId = jobId;

  startScraper(jobId);

  // 202 Accepted: we took the request, the work happens in the background.
  res.status(202).json(jobs.get(jobId));
});

// GET /ingest/status/:jobId
router.get("/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: "Unknown job id" });
  }

  res.json(job);
});

module.exports = router;
