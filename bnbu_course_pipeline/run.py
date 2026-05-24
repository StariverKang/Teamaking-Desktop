#!/usr/bin/env python3
"""BNBU Course Pipeline - Crawler + Cleaner for TEAMAKING import.

Usage:
    python run.py --semester 2025-Fall              # Full pipeline
    python run.py crawl --semester 2025-Fall        # Crawl + download only
    python run.py clean --semester 2025-Fall        # Clean from existing JSONL
    python run.py validate --semester 2025-Fall     # Validate existing cleaned JSON
    python run.py extract --semester 2025-Fall      # Extract PDFs to JSONL
"""

import argparse
import json
import os
import re
import sys

import yaml

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

from crawler.fetch_handbook_page import fetch_handbook_page, identify_major_code
from crawler.download_pdfs import download_pdfs, save_manifest
from crawler.extract_pdf_tables import extract_and_write_jsonl
from cleaner.parse_courses import parse_jsonl, deduplicate_courses
from cleaner.build_clean_json import build_clean_json, write_clean_json
from cleaner.validate import validate_clean_json

DATA_DIR = os.path.join(PROJECT_ROOT, "data")
CONFIG_DIR = os.path.join(PROJECT_ROOT, "config")


def load_config(name: str) -> dict:
    """Load a YAML config file."""
    path = os.path.join(CONFIG_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_semester_code(code: str) -> tuple[str, str, int, str]:
    """Parse semester code like '2025-Fall' into components.

    Returns (code, name, academic_year, term).
    """
    match = re.match(r"(\d{4})-(Fall|Spring|Summer)", code, re.I)
    if not match:
        print(f"Error: Invalid semester code '{code}'. Expected format: YYYY-Fall|Spring|Summer")
        sys.exit(1)
    year = int(match.group(1))
    term = match.group(2).capitalize()
    return code, f"{year} {term}", year, term


def do_crawl(semester_code: str, force: bool = False):
    """Fetch handbook page and download PDFs."""
    print(f"=== Crawling BNBU handbook page ===")
    links = fetch_handbook_page()
    print(f"Found {len(links)} PDF links")

    # Match to majors
    majors_config = load_config("majors.yml")
    for link in links:
        major_code = identify_major_code(link, majors_config)
        link["major_code"] = major_code or ""
        print(f"  [{link.get('faculty_code', '?')}] {link['major_hint']} -> {link.get('major_code', '?')}")

    # Download PDFs
    pdf_dir = os.path.join(DATA_DIR, "raw_files")
    print(f"\n=== Downloading PDFs to {pdf_dir} ===")
    manifest = download_pdfs(links, pdf_dir, force=force)

    manifest_path = os.path.join(DATA_DIR, "raw", f"{semester_code}_manifest.json")
    save_manifest(manifest, manifest_path)

    downloaded = sum(1 for m in manifest if not m.get("skipped") and not m.get("error"))
    skipped = sum(1 for m in manifest if m.get("skipped"))
    errors = sum(1 for m in manifest if m.get("error"))
    print(f"Downloaded: {downloaded}, Skipped: {skipped}, Errors: {errors}")

    return manifest


def do_extract(semester_code: str, manifest: list[dict] | None = None):
    """Extract PDF tables to JSONL."""
    if manifest is None:
        manifest_path = os.path.join(DATA_DIR, "raw", f"{semester_code}_manifest.json")
        if os.path.exists(manifest_path):
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
        else:
            print("No manifest found. Run 'crawl' first.")
            sys.exit(1)

    # Filter to successfully downloaded PDFs
    pdf_files = [m for m in manifest if m.get("local_path") and os.path.exists(m["local_path"])]
    print(f"\n=== Extracting courses from {len(pdf_files)} PDFs ===")

    jsonl_path = os.path.join(DATA_DIR, "raw", f"{semester_code}.jsonl")
    records = extract_and_write_jsonl(pdf_files, jsonl_path, semester_code)
    print(f"Extracted {len(records)} raw course records to {jsonl_path}")

    return records


def do_clean(semester_code: str, semester_name: str, academic_year: int, term: str):
    """Clean JSONL into final JSON."""
    jsonl_path = os.path.join(DATA_DIR, "raw", f"{semester_code}.jsonl")
    if not os.path.exists(jsonl_path):
        print(f"JSONL not found at {jsonl_path}. Run 'extract' first.")
        sys.exit(1)

    print(f"\n=== Cleaning {jsonl_path} ===")
    courses = parse_jsonl(jsonl_path)
    print(f"Parsed {len(courses)} course entries")

    courses_by_code = deduplicate_courses(courses)
    print(f"Deduplicated to {len(courses_by_code)} unique courses")

    # Load configs
    faculties_config = load_config("faculties.yml")
    majors_config = load_config("majors.yml")

    # Build source refs from manifest + JSONL rawIds
    manifest_path = os.path.join(DATA_DIR, "raw", f"{semester_code}_manifest.json")
    # Load manifest to get pdf_filenames for matching
    manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
    pdf_filenames = [m.get("pdf_filename", "") for m in manifest if m.get("pdf_filename")]

    # Collect rawIds per PDF filename from JSONL
    raw_ids_by_pdf: dict[str, list[str]] = {}
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            rid = rec.get("rawId", "")
            # Match rawId to pdf_filename by checking if filename appears in rawId
            for pdf_fn in pdf_filenames:
                if pdf_fn in rid:
                    raw_ids_by_pdf.setdefault(pdf_fn, []).append(rid)
                    break

    source_refs = []
    for m in manifest:
        if m.get("local_path"):
            pdf_filename = m.get("pdf_filename", "")
            major_code = m.get("major_code", "")
            major_name = ""
            if major_code and major_code in majors_config:
                major_name = majors_config[major_code].get("name", "")
            source_refs.append({
                "id": pdf_filename.replace(".pdf", ""),
                "title": f"{major_code} {major_name} Programme Handbook" if major_code else pdf_filename,
                "url": m.get("pdf_url", ""),
                "sourceType": "curriculum_pdf",
                "retrievedAt": m.get("downloaded_at", ""),
                    "rawIds": raw_ids_by_pdf.get(pdf_filename, []),
                })

    clean_data = build_clean_json(
        courses_by_code=courses_by_code,
        faculties_config=faculties_config,
        majors_config=majors_config,
        semester_code=semester_code,
        semester_name=semester_name,
        academic_year=academic_year,
        term=term,
        source_refs=source_refs,
    )

    # Write output
    output_filename = f"bnbu-{semester_code.lower()}.teamaking.json"
    output_path = os.path.join(DATA_DIR, "clean", output_filename)
    write_clean_json(clean_data, output_path)
    print(f"Written cleaned JSON to {output_path}")

    return clean_data


def do_validate(semester_code: str, clean_data: dict | None = None):
    """Validate cleaned JSON."""
    if clean_data is None:
        output_filename = f"bnbu-{semester_code.lower()}.teamaking.json"
        output_path = os.path.join(DATA_DIR, "clean", output_filename)
        if not os.path.exists(output_path):
            print(f"Cleaned JSON not found at {output_path}. Run 'clean' first.")
            sys.exit(1)
        with open(output_path, "r", encoding="utf-8") as f:
            clean_data = json.load(f)

    print(f"\n=== Validating cleaned JSON ===")
    result = validate_clean_json(clean_data)

    print(f"Schema version: {result.get('schemaVersion')}")
    print(f"Semester: {result.get('semesterCode')}")
    print(f"Counts: {json.dumps(result.get('counts', {}), indent=2)}")

    if result["errors"]:
        print(f"\nErrors ({len(result['errors'])}):")
        for e in result["errors"]:
            print(f"  ✗ {e}")

    if result["warnings"]:
        print(f"\nWarnings ({len(result['warnings'])}):")
        for w in result["warnings"]:
            print(f"  ⚠ {w}")

    if result["ok"]:
        print("\n✓ Validation passed!")
    else:
        print(f"\n✗ Validation failed with {len(result['errors'])} error(s).")

    return result


def main():
    parser = argparse.ArgumentParser(description="BNBU Course Pipeline")
    parser.add_argument("command", nargs="?", default="all",
                        choices=["all", "crawl", "extract", "clean", "validate"],
                        help="Pipeline command (default: all)")
    parser.add_argument("--semester", required=True,
                        help="Semester code, e.g. 2025-Fall")
    parser.add_argument("--force-download", action="store_true",
                        help="Force re-download existing PDFs")

    args = parser.parse_args()
    semester_code, semester_name, academic_year, term = parse_semester_code(args.semester)

    if args.command == "crawl":
        do_crawl(semester_code, force=args.force_download)

    elif args.command == "extract":
        do_extract(semester_code)

    elif args.command == "clean":
        do_clean(semester_code, semester_name, academic_year, term)

    elif args.command == "validate":
        do_validate(semester_code)

    elif args.command == "all":
        manifest = do_crawl(semester_code, force=args.force_download)
        do_extract(semester_code, manifest)
        clean_data = do_clean(semester_code, semester_name, academic_year, term)
        do_validate(semester_code, clean_data)


if __name__ == "__main__":
    main()
