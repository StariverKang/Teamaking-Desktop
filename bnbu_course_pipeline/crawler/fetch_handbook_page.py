"""Fetch the BNBU Academic Registry handbook page and extract PDF links."""

import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

HANDBOOK_URL = "https://ar.bnbu.edu.cn/info/1020/2927.htm"

# Map Chinese faculty/section names to faculty codes
FACULTY_HINTS = {
    "商管学院": "FBM",
    "文化与创意学院": "SCC",
    "人文社科学院": "FHSS",
    "理工科技学院": "FST",
}


def fetch_handbook_page(url: str = HANDBOOK_URL) -> list[dict]:
    """Fetch the handbook page and return a list of PDF link info dicts.

    Each dict has keys:
      - faculty_code: str (e.g. "FBM")
      - faculty_name: str (Chinese name from page)
      - major_hint: str (text near the link, usually programme name)
      - pdf_url: str (absolute URL)
      - pdf_filename: str (basename from URL)
    """
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or "utf-8"
    soup = BeautifulSoup(resp.text, "html.parser")

    results = []
    current_faculty_code = None
    current_faculty_name = None

    # The page structure has tables inside the content area.
    # Each faculty section has a heading, then a table with programme rows.
    content = soup.find("div", class_="wp_articlecontent") or soup.find("div", id="vsb_content") or soup

    # Strategy: walk through all elements in order to track faculty context
    for element in content.find_all(["h2", "h3", "h4", "strong", "b", "p", "table", "a"]):
        # Detect faculty headings
        if element.name in ("h2", "h3", "h4", "strong", "b", "p"):
            text = element.get_text(strip=True)
            for cn_name, code in FACULTY_HINTS.items():
                if cn_name in text:
                    current_faculty_code = code
                    current_faculty_name = cn_name
                    break

        # Extract PDF links from tables or direct links
        if element.name == "a":
            href = element.get("href", "")
            if href and href.lower().endswith(".pdf"):
                link_text = element.get_text(strip=True)
                full_url = urljoin(url, href)
                filename = full_url.split("/")[-1]
                results.append({
                    "faculty_code": current_faculty_code,
                    "faculty_name": current_faculty_name,
                    "major_hint": link_text or filename,
                    "pdf_url": full_url,
                    "pdf_filename": filename,
                })

        if element.name == "table":
            for a in element.find_all("a", href=True):
                href = a["href"]
                if href.lower().endswith(".pdf"):
                    link_text = a.get_text(strip=True)
                    full_url = urljoin(url, href)
                    filename = full_url.split("/")[-1]
                    results.append({
                        "faculty_code": current_faculty_code,
                        "faculty_name": current_faculty_name,
                        "major_hint": link_text or filename,
                        "pdf_url": full_url,
                        "pdf_filename": filename,
                    })

    # Deduplicate by URL
    seen = set()
    unique = []
    for item in results:
        if item["pdf_url"] not in seen:
            seen.add(item["pdf_url"])
            unique.append(item)

    return unique


def identify_major_code(pdf_info: dict, majors_config: dict) -> str | None:
    """Try to match a PDF link to a major code from config.

    Uses pdf_filename_hint from majors.yml to match against the PDF filename.
    """
    filename = pdf_info["pdf_filename"].upper()
    for code, info in majors_config.items():
        hint = info.get("pdf_filename_hint", "").upper()
        if hint and hint in filename:
            return code
    return None


if __name__ == "__main__":
    links = fetch_handbook_page()
    for link in links:
        print(f"[{link['faculty_code']}] {link['major_hint']} -> {link['pdf_url']}")
