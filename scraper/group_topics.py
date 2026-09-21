# group_topics.py
#
# This is the "core" of the assessment: grouping articles that are about
# the same story into clusters.
#
# Approach used: Option A from the assessment - simple keyword/word-overlap
# grouping. No machine learning, no TF-IDF, just comparing which
# meaningful words two articles share. See the README for why.

import re
from collections import Counter
from datetime import datetime, timezone

from config import MIN_SHARED_WORDS, STOPWORDS
import db


def get_significant_words(article):
    """
    Turn an article's title + summary into a set of "meaningful" words:
    lowercase, letters only, stopwords removed, very short words removed.
    """
    text = f"{article['title']} {article['summary'] or ''}".lower()

    # Split into words, keeping only letters (numbers/punctuation dropped).
    words = re.findall(r"[a-z]+", text)

    meaningful_words = {
        word for word in words
        if word not in STOPWORDS and len(word) > 2
    }
    return meaningful_words


class UnionFind:
    """
    A small helper structure that starts with every article in its own
    group, and lets us merge ("union") two groups together whenever we
    decide two articles belong to the same topic.

    This is the standard, simple way to build groups out of pairwise
    "these two are related" decisions.
    """

    def __init__(self, items):
        self.parent = {item: item for item in items}

    def find(self, item):
        # Follow the chain of parents up to the "root" of this group.
        while self.parent[item] != item:
            item = self.parent[item]
        return item

    def union(self, item_a, item_b):
        root_a = self.find(item_a)
        root_b = self.find(item_b)
        if root_a != root_b:
            self.parent[root_b] = root_a


def build_clusters(articles):
    """
    Given a list of article dicts (each with an 'id' and 'word_set'),
    return a dict mapping cluster_root_id -> list of articles in it.
    """
    ids = [article["id"] for article in articles]
    uf = UnionFind(ids)

    # Compare every pair of articles once and merge the related ones.
    # This is O(n^2), which is totally fine for a few hundred articles
    # (the scale this project deals with).
    for i in range(len(articles)):
        for j in range(i + 1, len(articles)):
            shared_words = articles[i]["word_set"] & articles[j]["word_set"]
            if len(shared_words) >= MIN_SHARED_WORDS:
                uf.union(articles[i]["id"], articles[j]["id"])

    groups = {}
    for article in articles:
        root = uf.find(article["id"])
        groups.setdefault(root, []).append(article)

    return groups


def make_cluster_label(articles_in_group):
    """
    Give the cluster a human-readable name.

    - If several articles are grouped together, we name it after the
      words they have in common (that shared vocabulary IS the topic),
      e.g. "Election / Senate / Vote".
    - If the cluster has only one article, shared words don't exist, so
      we just use that article's headline.
    """
    if len(articles_in_group) == 1:
        title = articles_in_group[0]["title"]
        return title if len(title) <= 70 else title[:67] + "..."

    word_counts = Counter()
    for article in articles_in_group:
        word_counts.update(article["word_set"])

    # Only keep words that show up in at least two of the articles -
    # those are the words that actually tie this group together.
    shared_words = [
        word for word, count in word_counts.most_common() if count >= 2
    ]

    if not shared_words:
        return "General News"

    return " / ".join(word.capitalize() for word in shared_words[:3])


def group_articles_into_clusters():
    """
    Main entry point for this file: read every article from the database,
    group them by shared keywords, and save the clusters back to the
    database.
    """
    print("Grouping articles into topic clusters...")

    raw_articles = db.get_all_articles()
    if not raw_articles:
        print("  no articles to group yet.")
        return

    # Attach a word_set to each article so we only compute it once.
    articles = []
    for article in raw_articles:
        articles.append({**article, "word_set": get_significant_words(article)})

    groups = build_clusters(articles)

    # Start clean - we recompute all clusters from scratch every run,
    # which keeps this logic simple and avoids complicated "merge this
    # new article into an existing cluster" edge cases.
    db.clear_clusters()

    now = datetime.now(timezone.utc).isoformat()
    for group_articles in groups.values():
        label = make_cluster_label(group_articles)
        cluster_id = db.insert_cluster(label, now)
        for article in group_articles:
            db.assign_article_to_cluster(article["id"], cluster_id)

    print(f"  -> created {len(groups)} clusters from {len(articles)} articles")
