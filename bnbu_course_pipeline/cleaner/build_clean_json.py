"""Build the final cleaned JSON conforming to teamaking.bnbu_course_import.v1."""

import json
import os
import re
from datetime import datetime, timezone

SCHEMA_VERSION = "teamaking.bnbu_course_import.v1"

# Classifications that map to default_join
DEFAULT_JOIN_CLASSIFICATIONS = {
    "major_required", "bba_core", "faculty_required", "college_core",
    "common_core", "required_core", "concentration_required",
    "university_core", "university_core_chinese", "university_core_english",
    "university_core_ai_literacy", "university_core_ppe",
    "university_core_military_training", "university_core_wpex",
    "university_core_healthy_lifestyle",
    "final_year_project", "internship",
}

# Classifications that are truly university-wide (allMajors: true)
# These apply to ALL students regardless of major.
UNIVERSITY_WIDE_CLASSIFICATIONS = {
    "university_core", "university_core_chinese", "university_core_english",
    "university_core_ai_literacy", "university_core_ppe",
    "university_core_military_training", "university_core_wpex",
    "university_core_healthy_lifestyle",
    "general_education", "ge_level_1_foundational",
    "ge_level_2_interdisciplinary_thematic", "ge_level_3_capstone",
    "free_elective", "unknown",
}

CLASSIFICATION_LABELS = {
    "major_required": "Major Required Courses",
    "major_elective": "Major Elective Courses",
    "bba_core": "BBA Core Courses",
    "faculty_required": "Faculty Required Courses",
    "college_core": "College Core Courses",
    "common_core": "Common Core Courses",
    "required_core": "Required Core Courses",
    "elective_core": "Elective Core Courses",
    "concentration_required": "Concentration Required Courses",
    "concentration_elective": "Concentration Elective Courses",
    "university_core": "University Core Courses",
    "university_core_chinese": "University Core Chinese",
    "university_core_english": "University Core English",
    "university_core_ai_literacy": "University Core AI Literacy",
    "university_core_ppe": "University Core PPE",
    "university_core_military_training": "University Core Military Training",
    "university_core_wpex": "University Core WPEX",
    "university_core_healthy_lifestyle": "University Core Healthy Lifestyle",
    "general_education": "General Education Courses",
    "ge_level_1_foundational": "GE Level 1 Foundational",
    "ge_level_2_interdisciplinary_thematic": "GE Level 2 Interdisciplinary Thematic",
    "ge_level_3_capstone": "GE Level 3 Capstone",
    "free_elective": "Free Elective Courses",
    "supporting_course": "Supporting Courses",
    "interdisciplinary_course": "Interdisciplinary Courses",
    "final_year_project": "Final Year Project",
    "internship": "Internship",
    "unknown": "Unknown",
}

# Student action for unknown classification
UNKNOWN_STUDENT_ACTION = "recommend_only"


def build_clean_json(
    courses_by_code: dict[str, dict],
    faculties_config: dict,
    majors_config: dict,
    semester_code: str,
    semester_name: str,
    academic_year: int,
    term: str,
    source_refs: list[dict],
) -> dict:
    """Build the complete cleaned JSON.

    Args:
        courses_by_code: from parse_courses.deduplicate_courses()
        faculties_config: from faculties.yml
        majors_config: from majors.yml
        semester_code: e.g. "2025-Fall"
        semester_name: e.g. "2025 Fall"
        academic_year: e.g. 2025
        term: e.g. "Fall"
        source_refs: list of sourceRef dicts

    Returns:
        dict conforming to teamaking.bnbu_course_import.v1
    """
    # Build lookup: major_code → faculty_code
    major_to_faculty = {}
    for mc, mi in majors_config.items():
        major_to_faculty[mc] = mi.get("facultyCode", "")

    # Build faculties list
    faculties = []
    for code, info in faculties_config.items():
        faculties.append({
            "code": code,
            "name": info["name"],
            "aliases": info.get("aliases", []),
        })

    # Build majors list
    majors = []
    for code, info in majors_config.items():
        majors.append({
            "code": code,
            "name": info["name"],
            "facultyCode": info["facultyCode"],
            "degreeType": info.get("degreeType", "undergraduate"),
            "aliases": info.get("aliases", []),
        })

    # Build courses list
    courses = []
    for code, data in courses_by_code.items():
        # Resolve ownerUnit: prefer explicit faculty_code, fallback to major's faculty
        owner_faculty = data.get("owner_faculty_code", "")
        if not owner_faculty:
            # Infer from the first major_code in classifications
            for combo in data.get("classifications", []):
                mc = combo.get("major_code", "")
                if mc and mc in major_to_faculty:
                    owner_faculty = major_to_faculty[mc]
                    break
        owner_unit = {}
        if owner_faculty and owner_faculty in faculties_config:
            owner_unit = {
                "type": "faculty",
                "code": owner_faculty,
                "name": faculties_config[owner_faculty]["name"],
            }

        # Collect category tags from classifications
        category_tags = []
        seen_classifications = set()
        for combo in data.get("classifications", []):
            cls = combo["classification"]
            if cls not in seen_classifications:
                seen_classifications.add(cls)
                label = CLASSIFICATION_LABELS.get(cls, cls)
                if label not in category_tags:
                    category_tags.append(label)

        # Collect source ref IDs
        source_ref_ids = list(set(
            combo.get("source_ref_id", "")
            for combo in data.get("classifications", [])
            if combo.get("source_ref_id")
        ))

        courses.append({
            "code": code,
            "title": data.get("course_title", ""),
            "credits": data.get("credits"),
            "ownerUnit": owner_unit,
            "categoryTags": category_tags,
            "description": "",
            "sourceRefIds": source_ref_ids,
        })

    # Build offerings and curriculum rules
    offerings = []
    curriculum_rules = []
    seen_offerings = set()
    seen_rules = set()

    for code, data in courses_by_code.items():
        for combo in data.get("classifications", []):
            cls = combo["classification"]
            major_code = combo.get("major_code", "")
            year = combo.get("year", "")
            semester = combo.get("semester", "")

            # Determine the offering semester code for this course
            offering_semester_code = _resolve_semester_code(
                semester_code, academic_year, term, year, semester
            )

            # Only create offering for the first semester (Year 1 Sem 1)
            # Programme handbooks are 4-year plans, not semester timetables.
            # Only courses in the first semester get an actual CourseBoard.
            is_first_semester = (year == "Year 1" and semester == "1")
            if is_first_semester:
                offering_key = (code, offering_semester_code, "Default")
                if offering_key not in seen_offerings:
                    seen_offerings.add(offering_key)
                    offerings.append({
                        "courseCode": code,
                        "semesterCode": offering_semester_code,
                        "teacherNames": [],
                        "sections": ["Default"],
                        "status": "active",
                        "sourceRefIds": [combo.get("source_ref_id", "")] if combo.get("source_ref_id") else [],
                        "syllabus": {
                            "teamworkRequirement": "unknown",
                            "teamworkSummary": "",
                            "evidenceSourceRefIds": [],
                            "confidence": "unknown",
                        },
                    })

            # Build curriculum rule
            audience_code = major_code if major_code else "ALL"
            grade_match = re.search(r"(\d)", year) if year else None
            grade_code = f"Y{grade_match.group(1)}" if grade_match else "all"
            cls_hyphen = cls.replace("_", "-")
            rule_id = f"{offering_semester_code}-{code}-{audience_code}-{grade_code}-{cls_hyphen}"

            if rule_id in seen_rules:
                continue
            seen_rules.add(rule_id)

            # Determine audience:
            # - University-wide courses (university_core, free_elective, GE, unknown): allMajors: true
            # - Major-specific courses (major_required, major_elective, bba_core, concentration_*): majorCodes: [X]
            is_university_wide = cls in UNIVERSITY_WIDE_CLASSIFICATIONS
            if is_university_wide or not major_code:
                audience = {
                    "majorCodes": [],
                    "facultyCodes": [],
                    "grades": [year] if year else [],
                    "cohortYears": [],
                    "concentrationCodes": [],
                    "allMajors": True,
                }
            else:
                audience = {
                    "majorCodes": [major_code],
                    "facultyCodes": [],
                    "grades": [year] if year else [],
                    "cohortYears": [],
                    "concentrationCodes": [],
                    "allMajors": False,
                }

            # Determine student action
            if cls == "unknown":
                student_action = UNKNOWN_STUDENT_ACTION
            elif cls in DEFAULT_JOIN_CLASSIFICATIONS:
                student_action = "default_join"
            else:
                student_action = "searchable_add"

            # Owner unit from the combo's faculty (or inferred from major)
            rule_faculty = combo.get("faculty_code", "")
            if not rule_faculty and major_code:
                rule_faculty = major_to_faculty.get(major_code, "")
            rule_owner_unit = {}
            if rule_faculty and rule_faculty in faculties_config:
                rule_owner_unit = {
                    "type": "faculty",
                    "code": rule_faculty,
                    "name": faculties_config[rule_faculty]["name"],
                }

            curriculum_rules.append({
                "id": rule_id,
                "courseCode": code,
                "semesterCode": offering_semester_code,
                "classification": cls,
                "classificationLabel": CLASSIFICATION_LABELS.get(cls, cls),
                "audience": audience,
                "studentAction": student_action,
                "ownerUnit": rule_owner_unit,
                "sourceRefIds": [combo.get("source_ref_id", "")] if combo.get("source_ref_id") else [],
                "confidence": "medium",
            })

    # Build semesters array from all referenced semester codes
    all_semester_codes = set()
    for o in offerings:
        all_semester_codes.add(o["semesterCode"])
    for r in curriculum_rules:
        all_semester_codes.add(r["semesterCode"])

    semesters = []
    for sc in sorted(all_semester_codes):
        parts = sc.split("-", 2)
        if len(parts) >= 2:
            try:
                s_year = int(parts[0])
                s_term = parts[1]
            except ValueError:
                s_year = academic_year
                s_term = term
        else:
            s_year = academic_year
            s_term = term
        semesters.append({
            "code": sc,
            "name": f"{s_year} {s_term}",
            "academicYear": s_year,
            "term": s_term,
            "isCurrentCandidate": False,
        })

    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "school": {
            "shortName": "BNBU",
            "name": "Beijing Normal-Hong Kong Baptist University",
            "emailDomain": "mail.bnbu.edu.cn",
        },
        "semester": {
            "code": semester_code,
            "name": semester_name,
            "academicYear": academic_year,
            "term": term,
            "isCurrentCandidate": False,
        },
        "semesters": semesters,
        "sourceRefs": source_refs,
        "faculties": faculties,
        "majors": majors,
        "courses": courses,
        "offerings": offerings,
        "curriculumRules": curriculum_rules,
    }


def _resolve_semester_code(
    base_code: str,
    base_year: int,
    base_term: str,
    course_year: str,
    course_semester: str,
) -> str:
    """Map a course's year+semester to an actual academic semester code.

    Args:
        base_code: e.g. "2025-Fall" (the intake semester)
        base_year: e.g. 2025
        base_term: e.g. "Fall"
        course_year: e.g. "Year 1", "Year 2", etc.
        course_semester: e.g. "1", "2"

    Returns:
        semester code like "2025-Fall", "2026-Spring", etc.
    """
    # Year offset: Year 1 = 0, Year 2 = 1, etc.
    year_match = re.search(r"(\d)", course_year) if course_year else None
    year_offset = int(year_match.group(1)) - 1 if year_match else 0

    # Semester determines Fall or Spring within the academic year
    # Sem 1 = Fall, Sem 2 = Spring (next calendar year)
    if course_semester == "1":
        sem_year = base_year + year_offset
        sem_term = "Fall"
    elif course_semester == "2":
        sem_year = base_year + year_offset + 1
        sem_term = "Spring"
    elif course_semester == "summer":
        sem_year = base_year + year_offset + 1
        sem_term = "Summer"
    elif course_semester == "winter":
        sem_year = base_year + year_offset
        sem_term = "Winter"
    else:
        # Unknown semester → use base
        return base_code

    return f"{sem_year}-{sem_term}"


def write_clean_json(clean_data: dict, output_path: str):
    """Write cleaned JSON to file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(clean_data, f, ensure_ascii=False, indent=2)
