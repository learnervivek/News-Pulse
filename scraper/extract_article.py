# extract_article.py
#
# RSS feeds only give us a short summary. This file fetches the real
# article page and pulls out the main body text, using plain requests +
# BeautifulSoup (no heavy NLP libraries needed).

import requests
from bs4 import BeautifulSoup

from config import REQUEST_TIMEOUT_SECONDS, USER_AGENT


def fetch_full_article_text(url):
    """
    Download an article page and return its main body text as a single
    string. If anything goes wrong (page down, blocked, not HTML, etc.)
    we return an empty string instead of crashing the whole scraper run.
    """
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"    could not download article page: {error}")
        return ""

    try:
        soup = BeautifulSoup(response.text, "html.parser")

        # Remove elements that are never part of the actual article text.
        for unwanted in soup(["script", "style", "nav", "header", "footer", "aside"]):
            unwanted.decompose()

        # Most news sites put the article body inside <p> tags.
        # Grabbing every <p> and joining them is a simple, reliable
        # heuristic that works reasonably well across different sites.
        paragraphs = [p.get_text(strip=True) for p in soup.find_all("p")]
        paragraphs = [p for p in paragraphs if len(p) > 40]  # drop short junk

        body_text = "\n".join(paragraphs)
        return body_text
    except Exception as error:
        print(f"    could not parse article page: {error}")
        return ""
