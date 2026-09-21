# db.py
#
# Everything related to talking to the SQLite database lives here.
# We use plain SQLite (via Python's built-in sqlite3 module) because it
# needs no separate server to install - just one file on disk.
# The Node.js backend reads from this exact same file.

import sqlite3
from config import DB_PATH


def get_connection():
    """Open a connection to the database file."""
    conn = sqlite3.connect(DB_PATH)
    # This makes rows behave like dictionaries (row["title"]) instead of
    # plain tuples, which is much easier to read.
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the tables if they don't already exist."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS clusters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            summary TEXT,
            body TEXT,
            published_at TEXT,
            fetched_at TEXT NOT NULL,
            cluster_id INTEGER,
            FOREIGN KEY (cluster_id) REFERENCES clusters (id)
        )
        """
    )

    conn.commit()
    conn.close()


def article_exists(url):
    """Check if we already saved an article with this URL."""
    conn = get_connection()
    row = conn.execute(
        "SELECT 1 FROM articles WHERE url = ?", (url,)
    ).fetchone()
    conn.close()
    return row is not None


def insert_article(article):
    """
    Save one new article to the database.
    `article` is a dict with: source, title, url, summary, body,
    published_at, fetched_at.
    Because `url` is UNIQUE, running this twice for the same article
    will not create a duplicate row - it raises an error we can ignore.
    """
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO articles
                (source, title, url, summary, body, published_at, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                article["source"],
                article["title"],
                article["url"],
                article["summary"],
                article["body"],
                article["published_at"],
                article["fetched_at"],
            ),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # Article with this URL already exists - that's fine, just skip it.
        pass
    finally:
        conn.close()


def get_all_articles():
    """Return every article currently in the database."""
    conn = get_connection()
    rows = conn.execute("SELECT * FROM articles").fetchall()
    conn.close()
    return [dict(row) for row in rows]


def clear_clusters():
    """
    Wipe cluster assignments before re-clustering.
    We recompute clusters from scratch on every run, which keeps the
    grouping logic simple (see group_topics.py).
    """
    conn = get_connection()
    conn.execute("UPDATE articles SET cluster_id = NULL")
    conn.execute("DELETE FROM clusters")
    conn.commit()
    conn.close()


def insert_cluster(label, created_at):
    """Create a new cluster row and return its id."""
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO clusters (label, created_at) VALUES (?, ?)",
        (label, created_at),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id


def assign_article_to_cluster(article_id, cluster_id):
    """Point one article at the cluster it belongs to."""
    conn = get_connection()
    conn.execute(
        "UPDATE articles SET cluster_id = ? WHERE id = ?",
        (cluster_id, article_id),
    )
    conn.commit()
    conn.close()
