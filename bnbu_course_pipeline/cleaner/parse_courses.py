"""Parse JSONL raw records into structured course data."""

import json
import re

from .normalize import (
    normalize_course_code,
    normalize_credits,
    normalize_semester,
    normalize_title,
)


def parse_jsonl(jsonl_path: str) -> list[dict]:
    """Read JSONL and extract structured course records.

    Returns list of dicts with keys:
      course_code, course_title, credits, classification, year, semester,
      major_code, faculty_code, source_ref_id
    """
    records = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            courses = _extract_courses_from_raw(raw)
            records.extend(courses)
    return records


def _extract_courses_from_raw(raw: dict) -> list[dict]:
    """Extract course records from a single JSONL raw record."""
    courses = []
    meta = raw.get("crawlerMeta", {})
    major_code = meta.get("major_code", "")
    faculty_code = meta.get("faculty_code", "")
    year = meta.get("year", "")
    semester = meta.get("semester", "")

    for table in raw.get("tables", []):
        classification = table.get("caption", "unknown")
        rows = table.get("rows", [])

        for row in rows:
            if len(row) < 2:
                continue

            code_raw = str(row[0]).strip() if row[0] else ""
            code = normalize_course_code(code_raw)
            if not code or not re.match(r"^[A-Z]{2,5}\d{3,5}$", code):
                continue

            title = normalize_title(str(row[1])) if len(row) > 1 and row[1] else ""
            credits = normalize_credits(row[2]) if len(row) > 2 else None

            # Derive PDF-level sourceRef ID from the rawId
            # rawId format: {semester_code}-{pdf_filename}-{course_code}-{index}
            # e.g. "2025-Fall-MCOM_2025.pdf-COMM1023-0"
            raw_id = raw.get("rawId", "")
            source_ref_id = ""
            if raw_id and code:
                # Find the PDF filename: everything between semester code and course code
                prefix = raw_id.split(f"-{code}-")[0] if f"-{code}-" in raw_id else ""
                if prefix:
                    # Remove semester code prefix (e.g. "2025-Fall-")
                    parts = prefix.split("-", 2)
                    if len(parts) >= 3:
                        source_ref_id = parts[2].replace(".pdf", "")

            courses.append({
                "course_code": code,
                "course_title": title,
                "credits": credits,
                "classification": classification,
                "year": year,
                "semester": semester,
                "major_code": major_code,
                "faculty_code": faculty_code,
                "source_ref_id": source_ref_id,
            })

    return courses


def deduplicate_courses(courses: list[dict]) -> dict[str, dict]:
    """Deduplicate courses by code. Returns dict keyed by course_code.

    For courses appearing in multiple majors/classifications, keeps the first
    occurrence's title and credits, but collects all classification+major pairs.
    """
    by_code: dict[str, dict] = {}

    for c in courses:
        code = c["course_code"]
        if code not in by_code:
            by_code[code] = {
                "course_code": code,
                "course_title": c["course_title"],
                "credits": c["credits"],
                "owner_faculty_code": c["faculty_code"],
                "classifications": [],
            }

        # Record this classification + major + year + semester combination
        entry = by_code[code]
        combo = {
            "classification": c["classification"],
            "major_code": c["major_code"],
            "faculty_code": c["faculty_code"],
            "year": c["year"],
            "semester": c["semester"],
            "source_ref_id": c["source_ref_id"],
        }
        if combo not in entry["classifications"]:
            entry["classifications"].append(combo)

        # Update title if empty
        if not entry["course_title"] and c["course_title"]:
            entry["course_title"] = c["course_title"]

        # Update credits if None
        if entry["credits"] is None and c["credits"] is not None:
            entry["credits"] = c["credits"]

    return by_code
