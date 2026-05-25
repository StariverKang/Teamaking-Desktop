"""Download programme handbook PDFs from BNBU."""

import hashlib
import json
import os
from datetime import datetime, timezone

import requests


def download_pdfs(
    pdf_links: list[dict],
    output_dir: str,
    force: bool = False,
) -> list[dict]:
    """Download PDF files and return metadata list.

    Args:
        pdf_links: list of dicts from fetch_handbook_page (needs pdf_url, pdf_filename)
        output_dir: directory to save PDFs
        force: if True, re-download even if file exists

    Returns:
        list of dicts with keys: pdf_url, pdf_filename, local_path, sha256,
        downloaded_at, http_status, content_length
    """
    os.makedirs(output_dir, exist_ok=True)
    manifest = []

    for link in pdf_links:
        filename = link["pdf_filename"]
        local_path = os.path.join(output_dir, filename)

        if os.path.exists(local_path) and not force:
            sha256 = _file_sha256(local_path)
            entry = {
                "pdf_url": link["pdf_url"],
                "pdf_filename": filename,
                "local_path": local_path,
                "sha256": sha256,
                "downloaded_at": None,
                "http_status": None,
                "content_length": os.path.getsize(local_path),
                "skipped": True,
            }
            entry["faculty_code"] = link.get("faculty_code", "")
            entry["major_code"] = link.get("major_code", "")
            manifest.append(entry)
            continue

        try:
            resp = requests.get(link["pdf_url"], timeout=60)
            resp.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(resp.content)

            sha256 = hashlib.sha256(resp.content).hexdigest()
            entry = {
                "pdf_url": link["pdf_url"],
                "pdf_filename": filename,
                "local_path": local_path,
                "sha256": sha256,
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "http_status": resp.status_code,
                "content_length": len(resp.content),
                "skipped": False,
            }
            entry["faculty_code"] = link.get("faculty_code", "")
            entry["major_code"] = link.get("major_code", "")
            manifest.append(entry)
        except Exception as e:
            entry = {
                "pdf_url": link["pdf_url"],
                "pdf_filename": filename,
                "local_path": None,
                "sha256": None,
                "downloaded_at": datetime.now(timezone.utc).isoformat(),
                "http_status": None,
                "content_length": None,
                "error": str(e),
            }
            entry["faculty_code"] = link.get("faculty_code", "")
            entry["major_code"] = link.get("major_code", "")
            manifest.append(entry)

    return manifest


def save_manifest(manifest: list[dict], output_path: str):
    """Save download manifest to JSON."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def _file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()
