# fetch_feeds.py
#
# Downloads each RSS feed and turns every entry into one simple,
# consistent dictionary - no matter how that particular feed is
# structured internally.

import re
from datetime import datetime, timezone
import feedparser
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from config import FEEDS


def normalize_date(entry):
    """
    Different feeds write the publish date differently (or not at all).
    We try a few options and always return either an ISO 8601 string
    or None - never crash because a date was missing/weird.
    """
    # feedparser already tries to parse the date into a "struct_time" for us.
    if getattr(entry, "published_parsed", None):
        dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        return dt.isoformat()

    # Some feeds use <updated> instead of <pubDate>.
    if getattr(entry, "updated_parsed", None):
        dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
        return dt.isoformat()

    # Last resort: try to parse whatever raw date string is there.
    raw_date = entry.get("published") or entry.get("updated")
    if raw_date:
        try:
            return date_parser.parse(raw_date).isoformat()
        except (ValueError, TypeError):
            pass

    return None


def strip_html(text):
    """
    Feed summaries often contain HTML (image tags, links, markup).
    We only want the readable sentence, so we strip the tags out -
    otherwise words like "img", "png" and "media" end up looking like
    the topic of the article when we group articles later.
    """
    if not text:
        return ""
    # If there are no tags at all, there is nothing to strip.
    if "<" not in text:
        return text.strip()
    return BeautifulSoup(text, "html.parser").get_text(separator=" ", strip=True)


def remove_boilerplate(text):
    """
    Some feeds glue the same phrase onto every single summary. NPR, for
    example, ends each one with "(Image credit: Some Photographer)".

    That matters a lot for us: every NPR story would then share the words
    "image" and "credit", and our grouping step would think completely
    unrelated stories belong to the same topic. So we cut those bits off.
    """
    text = re.sub(r"\(\s*Image credit:[^)]*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(Image source|Image caption|Getty Images),?", "", text, flags=re.IGNORECASE)
    return text.strip()


def normalize_summary(entry):
    """
    Some feeds put the article text in <description>, others in
    <content:encoded> (which feedparser exposes as entry.content).
    We prefer the longer/richer one when both exist, then strip HTML
    and the per-feed boilerplate.
    """
    description = entry.get("summary", "") or ""

    content_list = entry.get("content")
    content_text = content_list[0].get("value", "") if content_list else ""

    # Pick whichever field actually has text in it.
    if content_text and len(content_text) > len(description):
        return remove_boilerplate(strip_html(content_text))
    return remove_boilerplate(strip_html(description))


def fetch_one_feed(feed_name, feed_url):
    """Download one RSS feed and return a list of normalized articles."""
    print(f"Fetching feed: {feed_name} ({feed_url})")
    parsed = feedparser.parse(feed_url)

    articles = []
    for entry in parsed.entries:
        # Skip any entry that doesn't even have a link - we can't do
        # anything useful with it.
        url = entry.get("link")
        if not url:
            continue

        articles.append(
            {
                "source": feed_name,
                "title": entry.get("title", "(no title)"),
                "url": url,
                "summary": normalize_summary(entry),
                "published_at": normalize_date(entry),
            }
        )

    print(f"  -> found {len(articles)} articles")
    return articles


def fetch_all_feeds():
    """Download every configured feed and return one combined list."""
    all_articles = []
    for feed in FEEDS:
        try:
            all_articles.extend(fetch_one_feed(feed["name"], feed["url"]))
        except Exception as error:
            # One broken feed should never stop the whole run.
            print(f"  !! could not read feed '{feed['name']}': {error}")
    return all_articles
