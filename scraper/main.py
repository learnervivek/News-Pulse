# main.py
#
# This is the script that actually runs the whole pipeline, in order:
#   1. Make sure the database tables exist.
#   2. Pull the latest articles from all configured RSS feeds.
#   3. For any article we haven't seen before, fetch its full body text
#      and save it to the database.
#   4. Re-group every article in the database into topic clusters.
#
# Run it with:   python main.py
# You can run it again and again - already-saved articles are skipped
# (see db.article_exists), so it's safe to schedule this to run every
# few minutes.

from datetime import datetime, timezone

import db
from fetch_feeds import fetch_all_feeds
from extract_article import fetch_full_article_text
from group_topics import group_articles_into_clusters


def run_pipeline():
    print("=== News Pulse scraper starting ===")
    db.init_db()

    feed_articles = fetch_all_feeds()

    new_count = 0
    skipped_count = 0

    for article in feed_articles:
        if db.article_exists(article["url"]):
            skipped_count += 1
            continue

        print(f"New article: {article['title']}")
        full_text = fetch_full_article_text(article["url"])

        db.insert_article(
            {
                "source": article["source"],
                "title": article["title"],
                "url": article["url"],
                "summary": article["summary"],
                "body": full_text,
                "published_at": article["published_at"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        new_count += 1

    print(f"Saved {new_count} new articles ({skipped_count} already existed).")

    group_articles_into_clusters()

    print("=== News Pulse scraper finished ===")


if __name__ == "__main__":
    run_pipeline()
