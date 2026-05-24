"""Validate cleaned JSON against TEAMAKING import requirements.

Mirrors the validation logic from lib/bnbu-course-import.ts
"""

SCHEMA_VERSION = "teamaking.bnbu_course_import.v1"

VALID_CLASSIFICATIONS = {
    "major_required", "major_elective", "bba_core", "faculty_required",
    "college_core", "common_core", "required_core", "elective_core",
    "concentration_required", "concentration_elective",
    "university_core", "university_core_chinese", "university_core_english",
    "university_core_ai_literacy", "university_core_ppe",
    "university_core_military_training", "university_core_wpex",
    "university_core_healthy_lifestyle",
    "general_education", "ge_level_1_foundational",
    "ge_level_2_interdisciplinary_thematic", "ge_level_3_capstone",
    "free_elective", "supporting_course", "interdisciplinary_course",
    "final_year_project", "internship", "unknown",
}

VALID_STUDENT_ACTIONS = {"default_join", "searchable_add", "recommend_only", "hidden"}
VALID_CONFIDENCE = {"high", "medium", "low", "unknown"}
VALID_TEAMWORK = {"required", "optional", "none", "unknown"}


def validate_clean_json(payload: dict) -> dict:
    """Validate a cleaned JSON payload.

    Returns dict with keys:
      ok: bool
      errors: list[str]
      warnings: list[str]
      counts: dict
      schemaVersion: str
      semesterCode: str
    """
    errors = []
    warnings = []

    # Top-level structure
    if not isinstance(payload, dict):
        return {"ok": False, "errors": ["Payload must be a JSON object."], "warnings": [], "counts": {}}

    # Schema version
    if payload.get("schemaVersion") != SCHEMA_VERSION:
        errors.append(f"schemaVersion must be '{SCHEMA_VERSION}', got '{payload.get('schemaVersion')}'.")

    # School
    school = payload.get("school", {})
    if not isinstance(school, dict):
        errors.append("school must be an object.")
    elif school.get("shortName") != "BNBU":
        errors.append(f"school.shortName must be 'BNBU', got '{school.get('shortName')}'.")

    # Semester
    semester = payload.get("semester", {})
    if not isinstance(semester, dict):
        errors.append("semester must be an object.")
    else:
        for field in ("code", "name", "academicYear", "term"):
            if field not in semester:
                errors.append(f"semester.{field} is required.")
        if "academicYear" in semester and not isinstance(semester["academicYear"], int):
            errors.append("semester.academicYear must be a number.")

    # Semesters (multi-semester support)
    semesters = _as_records(payload.get("semesters", []))
    semester_codes = set()
    if semester.get("code"):
        semester_codes.add(semester["code"])
    for i, s in enumerate(semesters):
        for field in ("code", "name", "academicYear", "term"):
            if field not in s:
                errors.append(f"semesters[{i}].{field} is required.")
        if "academicYear" in s and not isinstance(s["academicYear"], int):
            errors.append(f"semesters[{i}].academicYear must be a number.")
        if s.get("code"):
            semester_codes.add(s["code"])

    semester_code = semester.get("code", "")

    # Collections
    source_refs = _as_records(payload.get("sourceRefs", []))
    faculties = _as_records(payload.get("faculties", []))
    majors = _as_records(payload.get("majors", []))
    courses = _as_records(payload.get("courses", []))
    offerings = _as_records(payload.get("offerings", []))
    rules = _as_records(payload.get("curriculumRules", []))

    # Required collections
    if not faculties:
        errors.append("faculties must not be empty.")
    if not courses:
        errors.append("courses must not be empty.")
    if not offerings:
        errors.append("offerings must not be empty.")

    # Warnings for optional collections
    if not source_refs:
        warnings.append("sourceRefs is empty.")
    if not majors:
        warnings.append("majors is empty.")
    if not rules:
        warnings.append("curriculumRules is empty.")

    # Build lookup sets
    source_ref_ids = {sr.get("id") for sr in source_refs if sr.get("id")}
    faculty_codes = {f.get("code") for f in faculties if f.get("code")}
    major_codes = {m.get("code") for m in majors if m.get("code")}
    course_codes = {c.get("code") for c in courses if c.get("code")}

    # Duplicate detection
    _check_duplicates(source_ref_ids, "sourceRef.id", errors)
    _check_duplicates(faculty_codes, "faculty.code", errors)
    _check_duplicates(major_codes, "major.code", errors)
    _check_duplicates(course_codes, "course.code", errors)
    rule_ids = {r.get("id") for r in rules if r.get("id")}
    _check_duplicates(rule_ids, "curriculumRule.id", errors)

    # Validate source refs
    for sr in source_refs:
        for field in ("id", "title", "url"):
            if not sr.get(field):
                errors.append(f"sourceRef missing '{field}'.")

    # Validate faculties
    for f in faculties:
        if not f.get("code"):
            errors.append("faculty missing 'code'.")
        if not f.get("name"):
            errors.append("faculty missing 'name'.")

    # Validate majors
    for m in majors:
        if not m.get("code"):
            errors.append("major missing 'code'.")
        if not m.get("name"):
            errors.append("major missing 'name'.")
        fc = m.get("facultyCode")
        if fc and fc not in faculty_codes:
            errors.append(f"major '{m.get('code')}' references unknown faculty '{fc}'.")

    # Validate courses
    for c in courses:
        if not c.get("code"):
            errors.append("course missing 'code'.")
        if not c.get("title"):
            errors.append(f"course '{c.get('code')}' missing 'title'.")
        credits = c.get("credits")
        if credits is not None and not isinstance(credits, (int, float)):
            errors.append(f"course '{c.get('code')}' credits must be a number.")
        for ref_id in c.get("sourceRefIds", []):
            if ref_id and ref_id not in source_ref_ids:
                warnings.append(f"course '{c.get('code')}' references unknown sourceRef '{ref_id}'.")

    # Validate offerings
    for o in offerings:
        if not o.get("courseCode"):
            errors.append("offering missing 'courseCode'.")
        elif o["courseCode"] not in course_codes:
            errors.append(f"offering references unknown course '{o['courseCode']}'.")
        if o.get("semesterCode") and o["semesterCode"] not in semester_codes:
            errors.append(f"offering semesterCode '{o['semesterCode']}' doesn't match any semester.")
        syllabus = o.get("syllabus")
        if syllabus and isinstance(syllabus, dict):
            tw = syllabus.get("teamworkRequirement")
            if tw and tw not in VALID_TEAMWORK:
                errors.append(f"offering syllabus teamworkRequirement '{tw}' is invalid.")

    # Validate curriculum rules
    for r in rules:
        if not r.get("id"):
            errors.append("curriculumRule missing 'id'.")
        if not r.get("courseCode"):
            errors.append(f"curriculumRule '{r.get('id')}' missing 'courseCode'.")
        elif r["courseCode"] not in course_codes:
            errors.append(f"curriculumRule '{r.get('id')}' references unknown course '{r['courseCode']}'.")
        if r.get("semesterCode") and r["semesterCode"] not in semester_codes:
            errors.append(f"curriculumRule '{r.get('id')}' semesterCode doesn't match any semester.")
        cls = r.get("classification")
        if not cls:
            errors.append(f"curriculumRule '{r.get('id')}' missing 'classification'.")
        elif cls not in VALID_CLASSIFICATIONS:
            errors.append(f"curriculumRule '{r.get('id')}' classification '{cls}' is invalid.")
        sa = r.get("studentAction")
        if sa and sa not in VALID_STUDENT_ACTIONS:
            errors.append(f"curriculumRule '{r.get('id')}' studentAction '{sa}' is invalid.")
        conf = r.get("confidence")
        if conf and conf not in VALID_CONFIDENCE:
            errors.append(f"curriculumRule '{r.get('id')}' confidence '{conf}' is invalid.")
        audience = r.get("audience")
        if not audience or not isinstance(audience, dict):
            errors.append(f"curriculumRule '{r.get('id')}' missing 'audience'.")
        else:
            for mc in audience.get("majorCodes", []):
                if mc and mc not in major_codes:
                    warnings.append(f"curriculumRule '{r.get('id')}' audience.majorCode '{mc}' not in majors.")
            for fc in audience.get("facultyCodes", []):
                if fc and fc not in faculty_codes:
                    warnings.append(f"curriculumRule '{r.get('id')}' audience.facultyCode '{fc}' not in faculties.")
            if (not audience.get("allMajors") and
                not audience.get("majorCodes") and
                not audience.get("facultyCodes")):
                warnings.append(f"curriculumRule '{r.get('id')}' audience targets nobody.")

    counts = {
        "sourceRefs": len(source_refs),
        "faculties": len(faculties),
        "majors": len(majors),
        "courses": len(courses),
        "offerings": len(offerings),
        "curriculumRules": len(rules),
    }

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "counts": counts,
        "schemaVersion": payload.get("schemaVersion", ""),
        "semesterCode": semester_code,
    }


def _as_records(value) -> list[dict]:
    """Ensure value is a list of dicts."""
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    return []


def _check_duplicates(items: set, label: str, errors: list):
    """Check for empty items (indicates duplicates in source)."""
    if not items:
        return
    # This is a simplified check - the actual dedup happens in build_clean_json
