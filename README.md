# News Pulse — Topic-Clustered News Timeline

News Pulse pulls live articles from three public news RSS feeds, automatically groups
articles that are about the same story into **topic clusters**, and plots those clusters
on a **timeline** so you can see which topics were active during which time window.

---

## Architecture

```
  RSS feeds                Python scraper              SQLite              Node.js API           Next.js frontend
 ------------             -----------------          ----------          --------------        ------------------
  BBC News     --\                                                          /clusters
  NPR          ----->   fetch -> clean -> save  -->   news_pulse.db  -->    /timeline     -->   timeline chart
  Al Jazeera   --/      -> group into clusters        (articles,            /ingest/*           cluster detail
                                                       clusters)                                source filter
```

| Folder      | Language          | What it does                                                        |
| ----------- | ----------------- | ------------------------------------------------------------------- |
| `/scraper`  | Python            | Reads the RSS feeds, fetches full article text, groups into clusters |
| `/backend`  | Node.js (Express) | REST API over the database; also starts the scraper on demand        |
| `/frontend` | Next.js / React   | The timeline UI                                                     |

Both the Python scraper and the Node API talk to the **same SQLite file**
(`news_pulse.db` in the project root). Python writes it, Node reads it.

### News sources used

- **BBC News** — `http://feeds.bbci.co.uk/news/rss.xml`
- **NPR** — `https://feeds.npr.org/1001/rss.xml`
- **Al Jazeera** — `https://www.aljazeera.com/xml/rss/all.xml`

They are listed in `scraper/config.py` — adding a fourth source is one line.

---

## Setup

### 1. Scraper (Python)

```bash
cd scraper
pip install -r requirements.txt
python main.py
```

The first run creates `news_pulse.db`, downloads the latest articles, and groups them.
Running it again only processes articles it hasn't seen before.

### 2. Backend (Node.js)

Requires **Node 22.5 or newer** (it uses Node's built-in `node:sqlite` module, so there
is no native package to compile).

```bash
cd backend
cp .env.example .env     # then edit .env if needed
npm install
npm start                # http://localhost:4000
```

> **Note on `PYTHON_BIN`:** the `POST /ingest/trigger` endpoint runs the Python scraper as
> a subprocess. If your machine has more than one Python installed, set `PYTHON_BIN` in
> `.env` to the full path of the one where you ran `pip install`. You can find it with
> `python -c "import sys; print(sys.executable)"`.

### 3. Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev              # http://localhost:3000
```

---

## How the topic grouping works

**Approach used: Option A — keyword / word-overlap grouping.**

For every article we take the headline + summary and:

1. Lowercase it and keep only letters.
2. Remove **stop words** (`the`, `is`, `and`, …) and words shorter than 3 letters.
3. What's left is that article's set of *significant words*.

Then we compare every pair of articles. If two articles share **3 or more** significant
words, we decide they are about the same topic and merge them into the same cluster
(using a small union-find structure, so that A–B and B–C end up in one group with A–C).

Each cluster is labelled with the words its articles have **in common** — that shared
vocabulary *is* the topic, e.g. `Merz / State / Chancellor`. A cluster holding only one
article is labelled with that article's headline instead.

### Why this approach

The assessment allows either keyword overlap or TF-IDF. I chose keyword overlap because:

- It is **explainable** — I can point at exactly which shared words caused two articles to
  be grouped, which makes wrong groupings easy to debug.
- It needs **no training data or model**, so it works from the very first run when the
  database holds only a handful of articles (TF-IDF gets weaker on tiny corpora).
- A simple approach that works reliably was explicitly preferred over a complex one.

### How I picked the threshold

I started at 4 shared words, which split obviously-related stories apart (two articles
about the same event often phrase headlines completely differently). At 2 shared words,
unrelated stories merged because any two political articles share words like "president"
and "government". **3 shared words** was the point where the clusters I inspected by hand
were coherent — the German-chancellor cluster below is a typical result:

```
Merz / State / Chancellor   (3 articles)
  NPR      - German chancellor stands his ground after his party loses in state elections
  BBC News - Katya Adler: Merz's political crisis threatens Germany's obsession with stability
  BBC News - Merz vows to keep coalition together for Germany's 'democratic future'
```

The threshold lives in `scraper/config.py` (`MIN_SHARED_WORDS`) so it is easy to tune.

### A limitation I noticed

**Shared words are not the same as a shared story.** Two different articles about two
different bombings can share "attack", "killed" and "forces" and get merged, while two
articles about the *same* event can stay apart if one says "chancellor" and the other says
"Merz". The algorithm matches vocabulary, not meaning.

The most visible symptom is that **most clusters end up with a single article** — each
outlet covers plenty of stories the others ignore. The frontend hides single-article
clusters by default (there's a checkbox to show them) so the timeline stays readable.

A second, more interesting limitation showed up during development: **feed boilerplate
poisons the grouping.** NPR appends `(Image credit: <photographer>)` to every summary, so
at one point every NPR story shared the words "image" and "credit" and 10 completely
unrelated articles were merged into one cluster. `remove_boilerplate()` in
`scraper/fetch_feeds.py` strips those phrases before grouping.

---

## API endpoints

Base URL locally: `http://localhost:4000`

| Method | Endpoint                | Purpose                                                           |
| ------ | ----------------------- | ----------------------------------------------------------------- |
| GET    | `/clusters`             | All clusters: label, article count, time range, sources            |
| GET    | `/clusters/:id`         | One cluster with all its articles, oldest first                    |
| GET    | `/timeline?days=7`      | Clusters shaped for charting: `start`, `end`, `articleCount`, `intensity` |
| POST   | `/ingest/trigger`       | Starts the Python scraper in the background, returns a `jobId`     |
| GET    | `/ingest/status/:jobId` | Poll a job: `running` / `completed` / `failed`                     |
| GET    | `/sources`              | Distinct source names (powers the frontend's source filter)        |
| GET    | `/health`               | Simple liveness check                                              |

**Why `/timeline` is a separate shape from `/clusters`:** a chart needs a start time, an
end time, a size value per item and the overall axis range. `/timeline` does that maths
server-side and returns `rangeStart` / `rangeEnd` plus an `intensity` value (0–1, relative
to the biggest cluster) so the frontend can size bars without recalculating anything.

**Why `/timeline` takes a `days` parameter:** feeds sometimes include an evergreen
explainer published a year ago. A single one of those stretched the time axis so far that
an entire day of real news was squashed into a sliver at the right edge. `days` (default
7, validated 1–365) bounds the window, and the axis always spans that whole window
(`rangeStart` = now − days, `rangeEnd` = now) rather than just the articles' own
timestamps — so switching between 24h / 7d / 30d in the UI visibly rescales the chart.

---

## Frontend features

- **Timeline visualization** — a hand-built Gantt-style chart (no charting library). Each
  cluster is a row; its bar spans from its earliest to its latest article, so the bar's
  position and length show *when* and *for how long* a topic was active. Bars get taller
  and bolder as the cluster grows (`intensity`).
- **Cluster detail view** — clicking a bar or a label opens a panel listing every article
  in that cluster with its source, published time, and a link to the original.
- **Source filter** — checkboxes toggle outlets. A cluster stays visible while at least one
  of its articles comes from a ticked source, and the detail panel hides articles from
  unticked sources too.
- **Refresh data** — calls `POST /ingest/trigger`, polls `GET /ingest/status/:jobId` every
  2.5 seconds, and reloads the timeline when the job completes.
- **Auto-refresh** *(stretch goal)* — optional checkbox; re-fetches `/timeline` every 60s.
- **Visual cluster sizing** *(stretch goal)* — bigger cluster = taller, more opaque bar.

---

## Handling messy feeds

The assessment called out that this should be more involved than one clean parse. What the
scraper deals with:

| Problem                                              | How it's handled                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Different field names (`<description>` vs `<content:encoded>`) | `normalize_summary()` checks both and keeps whichever has real text     |
| Missing `pubDate`, inconsistent date formats          | `normalize_date()` tries `published`, then `updated`, then `dateutil`, else `None` |
| HTML markup inside summaries                          | `strip_html()` removes tags before the text is used                             |
| Per-feed boilerplate (`(Image credit: …)`)            | `remove_boilerplate()` strips it, plus a stop-word safety net                   |
| Article pages that fail to load or parse              | `fetch_full_article_text()` catches the error, logs it, returns `""` and moves on |
| Duplicate articles across repeated runs               | `url` column is `UNIQUE`; `article_exists()` skips articles already stored        |
| Re-runnability                                        | Each run only downloads article pages for URLs it hasn't seen before             |

---

## Assumptions made

- **SQLite** is used rather than hosted Postgres/Mongo, because both the Python scraper and
  the Node API run on the same machine and SQLite needs no separate server. For deployment
  this means the scraper and API must share a filesystem (see below).
- **Clusters are recomputed from scratch** on every run rather than incrementally updated.
  With a few hundred articles the pairwise comparison is fast, and it avoids a whole class
  of "should this new article join an existing cluster or split it" edge cases.
- **Full article body text is stored but not used for grouping.** Grouping on headline +
  summary gave cleaner clusters; body text adds a lot of common vocabulary (navigation
  text, related-story blurbs) that pushes unrelated articles together.
- **The timeline shows a recent window (7 days by default)** rather than every article ever
  collected, for the axis-scaling reason described above.

---

## Deployment

| Component     | Platform                                                          |
| ------------- | ----------------------------------------------------------------- |
| Frontend      | Vercel — set `NEXT_PUBLIC_API_URL` to the deployed API URL          |
| Backend API   | Render / Railway — set `PORT`, `DB_PATH`, `PYTHON_BIN`, `CORS_ORIGIN` |
| Python pipeline | Runs on the API host, started on demand via `POST /ingest/trigger` (can also be scheduled with a cron job) |
| Database      | SQLite file on the API host's disk                                 |

Because the scraper is launched as a subprocess of the API, both need to live in the same
container — so the backend image needs Python and the scraper's `requirements.txt`
installed alongside Node. That is what the root `Dockerfile` builds, and `render.yaml`
deploys it. Environment variables are set on the hosting platform; `.env` files are
gitignored and never committed.

**Deploy steps:**

1. Push this repo to GitHub.
2. **Backend** — on Render: *New → Web Service → connect this repo*. It picks up
   `render.yaml` / `Dockerfile` automatically. Once live, set `CORS_ORIGIN` to your Vercel
   URL.
3. **Frontend** — on Vercel: *New Project → import this repo → root directory `frontend`*,
   and set the environment variable `NEXT_PUBLIC_API_URL` to the Render URL.
4. **Scheduled scraping** *(optional)* — `.github/workflows/scheduled-scrape.yml` calls
   `POST /ingest/trigger` every 6 hours. Add a repository secret `API_URL` pointing at the
   deployed backend to enable it.

> If the host's disk is ephemeral (e.g. Render's free tier), the database resets on
> redeploy. The fix, with more time, would be to move the storage layer to hosted Postgres
> — only `scraper/db.py` and `backend/db.js` would need to change, since all SQL lives
> in those two files.

---

## What I'd improve with more time

1. **Better grouping than word overlap** — TF-IDF weighting would stop common words
   carrying as much weight as distinctive ones (`Merz` should count for more than `state`).
2. **Incremental clustering** so new articles join existing clusters instead of the whole
   set being regrouped each run.
3. **Postgres instead of SQLite**, so the scraper and the API could scale independently.
4. **Tests** around the messy parts — date normalization and boilerplate stripping are
   exactly the kind of logic that deserves fixtures of real, ugly feed data.
