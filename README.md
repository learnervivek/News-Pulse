# News Pulse

News Pulse is a topic-clustered news timeline. It collects articles from public RSS feeds, cleans and stores them in SQLite, groups related stories by shared keywords, and displays the resulting topics in a React timeline.

The project is split into three services:

- **Python scraper**: fetches RSS feeds, normalizes article data, stores articles, and creates topic clusters.
- **Node.js API**: exposes the SQLite data through REST endpoints and can start the scraper in the background.
- **React frontend**: displays the timeline, source filters, cluster details, and refresh controls.

## Features

- Topic timeline covering the last 24 hours, 7 days, or 30 days
- Keyword-based clustering across BBC News, NPR, and Al Jazeera
- Cluster bars sized by article count and positioned by publication time
- Source filtering
- Cluster detail panel with links to original articles
- Manual data refresh through the Python scraper
- Optional 60-second auto-refresh
- SQLite storage with duplicate URL protection
- Responsive React/Vite interface

## Architecture

```text
RSS feeds
   |
   v
Python scraper ------> SQLite database <------ Node.js API <------ React/Vite frontend
   |                         |
   +-- clean articles        +-- articles
   +-- group topics           +-- clusters
```

The scraper and backend must use the same `news_pulse.db` file. The scraper writes articles and clusters; the backend reads them.

## Project Structure

```text
.
├── backend/
│   ├── db.js                 SQLite access layer
│   ├── package.json          Backend dependencies and scripts
│   ├── server.js             Express application entrypoint
│   └── routes/
│       ├── clusters.js       Cluster endpoints
│       ├── ingest.js         Background scraper jobs
│       └── timeline.js       Timeline endpoint
├── frontend/
│   ├── components/           Timeline, filters, and detail components
│   ├── lib/api.js            Frontend API client
│   ├── src/App.jsx           Main React application
│   ├── src/main.jsx          React/Vite entrypoint
│   ├── styles/globals.css    Application styles
│   ├── index.html            Vite HTML shell
│   └── package.json          Frontend dependencies and scripts
├── scraper/
│   ├── config.py             Feeds and grouping configuration
│   ├── db.py                 SQLite schema and write operations
│   ├── fetch_feeds.py        RSS parsing and normalization
│   ├── extract_article.py    Full article text extraction
│   ├── group_topics.py       Keyword clustering
│   ├── main.py               Scraper pipeline entrypoint
│   └── requirements.txt      Python dependencies
└── README.md
```

## Prerequisites

- Node.js **22.5 or newer**
- npm
- Python **3.9 or newer**
- Internet access for RSS feeds and article pages

Node 22.5 or newer is required because the backend uses Node's built-in `node:sqlite` module.

## Installation

Clone the repository and enter its directory:

```bash
git clone <repository-url>
cd "assignment 2"
```

### Install scraper dependencies

```bash
cd scraper
python3 -m pip install -r requirements.txt
cd ..
```

### Install backend dependencies

```bash
cd backend
cp .env.example .env
npm install
cd ..
```

### Install frontend dependencies

```bash
cd frontend
cp .env.local.example .env.local
npm install
cd ..
```

## Configuration

### Backend environment variables

Copy `backend/.env.example` to `backend/.env`:

| Variable         | Default            | Description                                                 |
| ---------------- | ------------------ | ----------------------------------------------------------- |
| `PORT`           | `4000`             | Port used by the Express API                                |
| `DB_PATH`        | `../news_pulse.db` | SQLite path relative to the backend directory               |
| `PYTHON_BIN`     | `python`           | Python executable used by background ingest                 |
| `SCRAPER_DIR`    | `../scraper`       | Scraper working directory relative to the backend directory |
| `SCRAPER_SCRIPT` | `main.py`          | Script started for ingest                                   |
| `CORS_ORIGIN`    | `*`                | Allowed frontend origin                                     |

If Python packages were installed into a specific interpreter, set `PYTHON_BIN` to its full path:

```bash
python3 -c "import sys; print(sys.executable)"
```

### Frontend environment variables

Copy `frontend/.env.local.example` to `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:4000
```

`VITE_API_URL` must point to the backend API. Vite exposes only variables prefixed with `VITE_` to browser code.

### Scraper configuration

Edit `scraper/config.py` to change:

- RSS feed names and URLs
- SQLite path
- Article request timeout
- Minimum shared words for clustering
- Stop words ignored by the clustering algorithm

## Running Locally

Start the backend in one terminal:

```bash
cd backend
npm start
```

The API will be available at `http://localhost:4000`.

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The UI will be available at `http://localhost:5173`.

Run the scraper once to initialize the database and load articles:

```bash
cd scraper
python3 main.py
```

The first run creates `news_pulse.db`. Later runs skip URLs already stored and recompute all clusters.

### Recommended startup order

1. Install Python dependencies.
2. Run `python3 main.py` from `scraper` once.
3. Start the backend.
4. Start the frontend.

The backend can also trigger the scraper through `POST /ingest/trigger`, but the Python dependencies must already be installed.

## NPM Scripts

### Backend

```bash
npm start       # Start the API
npm run dev     # Start the API with Node watch mode
```

### Frontend

```bash
npm run dev     # Start Vite development server
npm run build   # Create a production build in dist/
npm run preview # Preview the production build locally
```

## Topic Grouping

The scraper uses explainable keyword overlap rather than a machine-learning model.

For each article, the scraper:

1. Combines the title and summary.
2. Converts text to lowercase and keeps meaningful words.
3. Removes stop words, short words, and common feed boilerplate.
4. Compares each pair of articles.
5. Joins articles sharing at least three meaningful words.
6. Uses union-find grouping so related chains become one cluster.

The threshold is configured by `MIN_SHARED_WORDS` in `scraper/config.py` and defaults to `3`.

Cluster labels are made from shared words. A cluster with one article uses that article's title as its label.

This approach is fast and easy to inspect, but it compares vocabulary rather than meaning. Related stories with different wording may remain separate, while unrelated stories with similar wording can occasionally merge.

## Data Processing

The scraper handles common feed problems:

- Different summary fields such as `description` and `content:encoded`
- Missing or inconsistent publication dates
- HTML inside summaries
- Feed-specific boilerplate such as image credits
- Article pages that time out or cannot be parsed
- Duplicate URLs across repeated runs
- Re-running the pipeline without creating duplicate records

Full article text is stored when available, but clustering uses the title and summary because article bodies often contain unrelated navigation and recommendation text.

## API Reference

Base URL:

```text
http://localhost:4000
```

### `GET /health`

Returns an API liveness response.

```json
{
  "status": "ok",
  "time": "2026-09-22T17:00:00.000Z"
}
```

### `GET /sources`

Returns distinct article sources.

```json
{
  "sources": ["Al Jazeera", "BBC News", "NPR"]
}
```

### `GET /clusters`

Returns all clusters with labels, article counts, time ranges, and source names.

### `GET /clusters/:id`

Returns one cluster and its articles ordered from oldest to newest.

### `GET /timeline?days=7`

Returns chart-ready cluster data. `days` must be between `1` and `365`; the default is `7`.

The response includes:

- `rangeStart` and `rangeEnd`: the complete requested timeline range
- `count`: number of plottable clusters
- `items`: cluster bars with `start`, `end`, `articleCount`, `intensity`, and `sources`

Example request:

```bash
curl "http://localhost:4000/timeline?days=7"
```

### `POST /ingest/trigger`

Starts the scraper in the background and returns a job record with a `jobId`.

```bash
curl -X POST http://localhost:4000/ingest/trigger
```

Only one ingest job can run at a time. A second request returns HTTP `409` while the first job is running.

### `GET /ingest/status/:jobId`

Returns the current state of an ingest job:

- `running`
- `completed`
- `failed`

## Frontend Usage

- Choose a time window from the selector.
- Toggle sources to filter visible clusters.
- Enable **Show single-article topics** to include clusters with one article.
- Click a topic label or timeline bar to open its article details.
- Select **Auto-refresh** to reload timeline data every 60 seconds.
- Select **Refresh data** to run the scraper and reload the interface when it completes.

## Deployment

### Backend hosting

Deploy the `backend` and `scraper` directories together on a host that supports Node.js and Python. The API starts the scraper as a subprocess, so both services must run on the same machine and share the SQLite file.

After deployment:

1. Confirm the backend `/health` endpoint.
2. Set `CORS_ORIGIN` to the deployed frontend URL.
3. Set `DB_PATH`, `PYTHON_BIN`, and scraper paths if the hosting layout changes.
4. Trigger an initial ingest with `POST /ingest/trigger`.

### Vite frontend hosting

Build the frontend:

```bash
cd frontend
npm run build
```

Deploy the generated `frontend/dist` directory to a static host such as Vercel, Netlify, or Cloudflare Pages. Set:

```env
VITE_API_URL=https://your-api.example.com
```

The frontend must be rebuilt after changing `VITE_API_URL` because Vite embeds environment values during the build.

### Database persistence

SQLite is stored on the API host's filesystem. Ephemeral hosting disks can reset the database during redeploys or restarts. For durable production storage, replace the SQLite access layer with a hosted database or attach persistent storage to the API service.

## Troubleshooting

### `no such table: clusters` or `no such table: articles`

Run the scraper once before using the API:

```bash
cd scraper
python3 main.py
```

### `ModuleNotFoundError: No module named 'feedparser'`

Install the scraper dependencies in the same Python environment used by the backend:

```bash
cd scraper
python3 -m pip install -r requirements.txt
```

Then set `PYTHON_BIN` in `backend/.env` if necessary.

### Frontend cannot reach the API

Check that:

1. The backend is running on port 4000.
2. `frontend/.env.local` contains the correct `VITE_API_URL`.
3. The frontend was restarted after changing the environment file.
4. `CORS_ORIGIN` allows the frontend origin.

### Ingest job fails to start Python

Check `PYTHON_BIN`, `SCRAPER_DIR`, and `SCRAPER_SCRIPT` in `backend/.env`. Run the scraper directly first to expose missing packages or network errors.

### Frontend build or dev server fails

Reinstall frontend dependencies and retry:

```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

### Feed or article requests time out

The scraper logs failed article requests and continues processing. Check network access and the feed URLs in `scraper/config.py`.

## Development Notes

- The API keeps ingest job state in memory; restarting the backend removes old job records.
- Clusters are recomputed from all stored articles on every scraper run.
- The API and scraper must agree on the database path.
- RSS feeds and article pages can change their formats or availability without notice.
- The application currently has no automated test suite; manual checks should include the scraper, `/health`, `/timeline`, frontend build, and a cluster detail click.

## Future Improvements

- Add unit tests for date normalization, summary cleanup, and clustering.
- Use TF-IDF or embeddings for more semantic grouping.
- Add persistent ingest job records.
- Move production storage from SQLite to Postgres.
- Add pagination for large cluster and article collections.
- Add structured logging and metrics.

## License

No license has been specified for this project. Add a `LICENSE` file before distributing it publicly.
