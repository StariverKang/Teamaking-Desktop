"""Extract course tables from BNBU programme handbook PDFs.

All BNBU programme PDFs use the same table format:
  Col 0: Course Code
  Col 1: Course Title
  Col 2-11: Year1-Sem1, Year1-Winter, Year1-Sem2, Year2-Sem1, Year2-Sem2,
            Year2-Summer, Year3-Sem1, Year3-Sem2, Year4-Sem1, Year4-Sem2

Each course row has a credit value in the column matching its semester.
"""

import json
import os
import re
from datetime import datetime, timezone

import pdfplumber

# Matches course codes like COMP1023, UCLC1003, MATH1003, CHI1103, MT1003
# Allows trailing footnotes: ①②③* etc.
COURSE_CODE_RE = re.compile(
    r"^([A-Z]{2,5}\d{3,5})[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳*\s/]*"
)

# Section header patterns
SECTION_PATTERNS = [
    (re.compile(r"Major\s+Required", re.I), "major_required"),
    (re.compile(r"Major\s+Elective|ME\s+Course", re.I), "major_elective"),
    (re.compile(r"University\s+Core", re.I), "university_core"),
    (re.compile(r"General\s+Education", re.I), "general_education"),
    (re.compile(r"Free\s+Elective", re.I), "free_elective"),
    (re.compile(r"Faculty\s+Required", re.I), "faculty_required"),
    (re.compile(r"College\s+Core", re.I), "college_core"),
    (re.compile(r"Common\s+Core", re.I), "common_core"),
    (re.compile(r"Required\s+Core", re.I), "required_core"),
    (re.compile(r"Elective\s+Core", re.I), "elective_core"),
    (re.compile(r"Concentration\s+Required", re.I), "concentration_required"),
    (re.compile(r"Concentration\s+Elective", re.I), "concentration_elective"),
    (re.compile(r"BBA.*Core", re.I), "bba_core"),
    (re.compile(r"Final\s+Year\s+Project", re.I), "final_year_project"),
    (re.compile(r"Internship", re.I), "internship"),
    (re.compile(r"Supporting", re.I), "supporting_course"),
    (re.compile(r"Interdisciplinary", re.I), "interdisciplinary_course"),
]

# Column index to (year, semester) mapping for Format B
# Col 2=Year1-Sem1, Col 3=Year1-Winter, Col 4=Year1-Sem2,
# Col 5=Year2-Sem1, Col 6=Year2-Sem2, Col 7=Year2-Summer,
# Col 8=Year3-Sem1, Col 9=Year3-Sem2, Col 10=Year4-Sem1, Col 11=Year4-Sem2
COL_TO_YEAR_SEM = {
    2: ("Year 1", "1"),
    3: ("Year 1", "winter"),
    4: ("Year 1", "2"),
    5: ("Year 2", "1"),
    6: ("Year 2", "2"),
    7: ("Year 2", "summer"),
    8: ("Year 3", "1"),
    9: ("Year 3", "2"),
    10: ("Year 4", "1"),
    11: ("Year 4", "2"),
}


def extract_courses_from_pdf(pdf_path: str, source_url: str = "") -> list[dict]:
    """Extract course data from a single PDF.

    Returns list of raw course dicts with keys:
      course_code, course_title, credits, classification, year, semester,
      source_pdf, source_url
    """
    courses = []
    current_classification = "unknown"

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Detect page-level context from page text
            page_text = page.extract_text() or ""
            page_classification = None
            if re.search(r"ME\s+Course\s+List", page_text, re.I):
                page_classification = "major_elective"
            elif re.search(r"FE\s+Course\s+List", page_text, re.I):
                page_classification = "free_elective"

            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 3:
                    continue

                # Verify this is a course table by checking header
                header = table[0]
                if not header or not any(
                    h and ("Year" in str(h) or "Course Code" in str(h))
                    for h in header if h
                ):
                    continue

                # Detect if this is a multi-column (Format B) or simple (3-col) table
                is_format_b = len(table[0]) > 3

                # For simple tables on ME/FE list pages, use page-level classification
                if not is_format_b and page_classification:
                    current_classification = page_classification

                # Parse rows (skip only the first header row)
                for row in table[1:]:
                    if not row or not row[0]:
                        continue

                    cell0 = str(row[0]).strip()

                    # Check for section header
                    section = _detect_section(cell0)
                    if section:
                        current_classification = section
                        continue

                    # Skip sub-section headers like "(i) MR Courses on..."
                    if cell0.startswith("(") and ")" in cell0:
                        continue

                    # Skip ME/FE slot rows (e.g. "ME01 ME02 ME03 ME04")
                    if re.match(r"^(ME|FE)\d", cell0):
                        continue

                    # Skip non-course rows
                    if not COURSE_CODE_RE.match(cell0):
                        continue

                    code_match = COURSE_CODE_RE.match(cell0)
                    code = code_match.group(1)

                    # Clean title
                    title = str(row[1]).strip() if len(row) > 1 and row[1] else ""
                    title = re.sub(r"\s+", " ", title).strip()

                    # Extract credits
                    if not is_format_b and len(row) > 2 and row[2]:
                        # Simple 3-column table: Code | Title | Credits
                        cell_val = str(row[2]).strip()
                        cell_val = re.sub(r"[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳*#]+", "", cell_val)
                        cell_val = cell_val.strip()
                        if cell_val and cell_val.isdigit():
                            courses.append({
                                "course_code": code,
                                "course_title": title,
                                "credits": int(cell_val),
                                "classification": current_classification,
                                "year": "",
                                "semester": "",
                                "source_pdf": os.path.basename(pdf_path),
                                "source_url": source_url,
                            })
                    else:
                        # Format B: find which semester column has a credit value
                        for col_idx, (year, semester) in COL_TO_YEAR_SEM.items():
                            if col_idx < len(row) and row[col_idx]:
                                cell_val = str(row[col_idx]).strip()
                                cell_val = re.sub(r"[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳*#]+", "", cell_val)
                                cell_val = cell_val.strip()
                                if cell_val and cell_val.isdigit():
                                    courses.append({
                                        "course_code": code,
                                        "course_title": title,
                                        "credits": int(cell_val),
                                        "classification": current_classification,
                                        "year": year,
                                        "semester": semester,
                                        "source_pdf": os.path.basename(pdf_path),
                                        "source_url": source_url,
                                    })
                                    break  # Only take first match per course row

    return courses


def _detect_section(line: str) -> str | None:
    """Detect if a line is a section/classification header."""
    for pattern, classification in SECTION_PATTERNS:
        if pattern.search(line):
            return classification
    return None


def extract_and_write_jsonl(
    pdf_files: list[dict],
    output_path: str,
    semester_code: str,
) -> list[dict]:
    """Extract courses from multiple PDFs and write JSONL.

    Args:
        pdf_files: list of dicts with keys: local_path, pdf_url, faculty_code, major_code
        output_path: path to write JSONL
        semester_code: target semester code (e.g. "2025-Fall")

    Returns:
        list of all raw records written
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    all_records = []

    for pdf_info in pdf_files:
        local_path = pdf_info.get("local_path")
        if not local_path or not os.path.exists(local_path):
            continue

        courses = extract_courses_from_pdf(
            local_path,
            source_url=pdf_info.get("pdf_url", ""),
        )

        for i, course in enumerate(courses):
            record = {
                "rawId": f"{semester_code}-{course['source_pdf']}-{course['course_code']}-{i}",
                "retrievedAt": datetime.now(timezone.utc).isoformat(),
                "url": course.get("source_url", ""),
                "sourceType": "curriculum_pdf",
                "httpStatus": 200,
                "contentType": "application/pdf",
                "title": f"{course.get('source_pdf', '')} - {course['course_code']}",
                "facultyHint": pdf_info.get("faculty_code", ""),
                "majorHint": pdf_info.get("major_code", ""),
                "semesterHint": semester_code,
                "rawText": "",
                "tables": [{
                    "caption": course.get("classification", "unknown"),
                    "headers": ["Course Code", "Course Title", "Credits", "Semester"],
                    "rows": [[
                        course["course_code"],
                        course.get("course_title", ""),
                        str(course.get("credits", "")),
                        course.get("semester", ""),
                    ]],
                }],
                "links": [],
                "crawlerMeta": {
                    "parser": "pdfplumber-table-v1",
                    "classification": course.get("classification", "unknown"),
                    "year": course.get("year", ""),
                    "semester": course.get("semester", ""),
                    "major_code": pdf_info.get("major_code", ""),
                    "faculty_code": pdf_info.get("faculty_code", ""),
                },
            }
            all_records.append(record)

    # Write JSONL
    with open(output_path, "w", encoding="utf-8") as f:
        for record in all_records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    return all_records
