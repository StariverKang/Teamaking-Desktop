"""Text normalization utilities for BNBU course data cleaning."""

import re

# Footnote markers found in BNBU PDFs
FOOTNOTE_CHARS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
FOOTNOTE_RE = re.compile(f"[{re.escape(FOOTNOTE_CHARS)}]+\\*?")

# Fullwidth to halfwidth mapping for common characters
FW_TO_HW = str.maketrans(
    "０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ"
    "ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ"
    "（）【】，。；：＋－＝　",
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "()[],.;:+-= ",
)


def normalize_course_code(code: str) -> str:
    """Normalize a course code: uppercase, strip, remove internal spaces."""
    code = code.strip()
    code = code.translate(FW_TO_HW)
    code = FOOTNOTE_RE.sub("", code)
    code = re.sub(r"\s+", "", code)
    return code.upper()


def normalize_title(title: str) -> str:
    """Normalize a course title: strip, collapse whitespace."""
    title = title.strip()
    title = title.translate(FW_TO_HW)
    title = FOOTNOTE_RE.sub("", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip()


def normalize_credits(value) -> int | None:
    """Normalize credits to an integer.

    Accepts: "3", "3.0", "3 credits", 3, None
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    s = str(value).strip()
    s = s.translate(FW_TO_HW)
    # Extract first number
    match = re.search(r"(\d+(?:\.\d+)?)", s)
    if match:
        return int(float(match.group(1)))
    return None


def normalize_semester(sem: str) -> str:
    """Normalize semester string to '1', '2', 'summer', 'winter', or ''."""
    sem = sem.strip().lower()
    sem = sem.translate(FW_TO_HW)
    if sem in ("1", "sem 1", "semester 1", "fall", "autumn"):
        return "1"
    if sem in ("2", "sem 2", "semester 2", "spring"):
        return "2"
    if "summer" in sem:
        return "summer"
    if "winter" in sem:
        return "winter"
    return sem


def normalize_year(year: str | None) -> str | None:
    """Normalize year string to 'Year N' format."""
    if not year:
        return None
    year = year.strip()
    match = re.search(r"(\d)", year)
    if match:
        return f"Year {match.group(1)}"
    return year


def normalize_type(type_str: str) -> str:
    """Normalize course type to 'R' or 'E'."""
    t = type_str.strip().upper()
    if t in ("R", "REQUIRED", "必修"):
        return "R"
    if t in ("E", "ELECTIVE", "选修"):
        return "E"
    return t
