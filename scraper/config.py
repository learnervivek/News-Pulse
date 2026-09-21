# config.py
#
# All the "settings" for the scraper live here, in one place, so nothing
# is hard-coded deep inside the other files.

import os

# The three RSS feeds we pull articles from.
# Feel free to add more - each one just needs a "name" and a "url".
FEEDS = [
    {"name": "BBC News", "url": "http://feeds.bbci.co.uk/news/rss.xml"},
    {"name": "NPR", "url": "https://feeds.npr.org/1001/rss.xml"},
    {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
]

# Where the SQLite database file is stored.
# The Node.js backend reads from this exact same file.
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "news_pulse.db"),
)

# When fetching the full article body, don't wait forever on a slow page.
REQUEST_TIMEOUT_SECONDS = 8

# A normal-looking User-Agent so sites don't block us for looking like a bot.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "NewsPulseBot/1.0 (educational assessment project)"
)

# --- Topic-grouping settings (see group_topics.py) ---

# Two articles are considered "related" if they share at least this many
# meaningful (non-stopword) words in their title + summary.
MIN_SHARED_WORDS = 3

# Common words we ignore when comparing articles, because almost every
# article contains them and they don't tell us anything about the topic.
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "so", "of", "in",
    "on", "at", "to", "for", "with", "by", "from", "up", "down", "is",
    "are", "was", "were", "be", "been", "being", "this", "that", "these",
    "those", "it", "its", "as", "not", "no", "do", "does", "did", "has",
    "have", "had", "will", "would", "could", "should", "can", "may",
    "might", "must", "about", "after", "before", "over", "under", "into",
    "out", "off", "than", "too", "very", "just", "he", "she", "they",
    "we", "you", "i", "his", "her", "their", "our", "your", "who",
    "what", "when", "where", "why", "how", "says", "said", "new",
    # Words that come from feed boilerplate rather than the story itself
    # (photo credits, "Watch:" prefixes, outlet names).
    "image", "credit", "photo", "caption", "getty", "images", "watch",
    "video", "live", "news", "bbc", "npr", "reuters", "jazeera",
}
