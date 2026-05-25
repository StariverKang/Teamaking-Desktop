export const bnbuCourseClassifications = [
  "major_required",
  "major_elective",
  "bba_core",
  "faculty_required",
  "college_core",
  "common_core",
  "required_core",
  "elective_core",
  "concentration_required",
  "concentration_elective",
  "university_core",
  "university_core_chinese",
  "university_core_english",
  "university_core_ai_literacy",
  "university_core_ppe",
  "university_core_military_training",
  "university_core_wpex",
  "university_core_healthy_lifestyle",
  "general_education",
  "ge_level_1_foundational",
  "ge_level_2_interdisciplinary_thematic",
  "ge_level_3_capstone",
  "free_elective",
  "supporting_course",
  "interdisciplinary_course",
  "final_year_project",
  "internship",
  "unknown"
] as const;

export const bnbuStudentActions = ["default_join", "searchable_add", "recommend_only", "hidden"] as const;
export const bnbuConfidenceLevels = ["high", "medium", "low", "unknown"] as const;
export const bnbuTeamworkRequirements = ["required", "optional", "none", "unknown"] as const;
export const bnbuCourseImportSchemaVersions = ["teamaking.bnbu_course_import.v1", "teamaking.bnbu_course_import.v2"] as const;

export type BnbuCourseClassification = (typeof bnbuCourseClassifications)[number];
export type BnbuStudentAction = (typeof bnbuStudentActions)[number];

const classificationSet = new Set<string>(bnbuCourseClassifications);
const studentActionSet = new Set<string>(bnbuStudentActions);
const confidenceSet = new Set<string>(bnbuConfidenceLevels);
const teamworkRequirementSet = new Set<string>(bnbuTeamworkRequirements);
const schemaVersionSet = new Set<string>(bnbuCourseImportSchemaVersions);

const programmeScopedClassifications = new Set<string>([
  "major_required",
  "major_elective",
  "concentration_required",
  "concentration_elective"
]);

const requiredProgrammeScopedClassifications = new Set<string>([
  "major_required",
  "concentration_required"
]);

const handbookOnlySourceTypes = new Set<string>([
  "curriculum_page",
  "curriculum_pdf",
  "programme_structure"
]);

const autoJoinClassifications = new Set<string>([
  "major_required",
  "bba_core",
  "faculty_required",
  "college_core",
  "common_core",
  "required_core",
  "concentration_required",
  "university_core",
  "university_core_chinese",
  "university_core_english",
  "university_core_ai_literacy",
  "university_core_ppe",
  "university_core_military_training",
  "university_core_wpex",
  "university_core_healthy_lifestyle",
  "final_year_project",
  "internship"
]);

export const bnbuClassificationLabels: Record<BnbuCourseClassification, string> = {
  major_required: "Major Required Courses",
  major_elective: "Major Elective Courses",
  bba_core: "BBA(Hons) Core Courses",
  faculty_required: "Faculty Required Courses",
  college_core: "College Core Courses",
  common_core: "Common Core Courses",
  required_core: "Required Core Courses",
  elective_core: "Elective Core Courses",
  concentration_required: "Concentration Required Courses",
  concentration_elective: "Concentration Elective Courses",
  university_core: "University Core Courses",
  university_core_chinese: "University Core - Chinese",
  university_core_english: "University Core - English",
  university_core_ai_literacy: "University Core - AI Literacy",
  university_core_ppe: "University Core - Philosophy, Politics and Economics",
  university_core_military_training: "University Core - Military Training",
  university_core_wpex: "University Core - WPEX",
  university_core_healthy_lifestyle: "University Core - Healthy Lifestyle",
  general_education: "General Education",
  ge_level_1_foundational: "GE Level 1 - Foundational Courses",
  ge_level_2_interdisciplinary_thematic: "GE Level 2 - Interdisciplinary Thematic Courses",
  ge_level_3_capstone: "GE Level 3 - Capstone",
  free_elective: "Free Elective Courses",
  supporting_course: "Supporting Courses",
  interdisciplinary_course: "Interdisciplinary Courses",
  final_year_project: "Final Year Project",
  internship: "Internship",
  unknown: "Unknown"
};

export type BnbuValidationSummary = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<string, number>;
  schemaVersion?: string;
  semesterCode?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function relativeTermCodeIsValid(value: string) {
  return /^Y[1-6]S[1-3]$/i.test(value);
}

function semesterTermOffset(term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("spring") || normalized === "s2" || normalized.includes("semester 2")) return 0;
  if (normalized.includes("fall") || normalized.includes("autumn") || normalized === "s1" || normalized.includes("semester 1")) return 1;
  return null;
}

function currentAcademicTermIndex(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const termOffset = month >= 8 ? 1 : 0;
  return year * 2 + termOffset;
}

function semesterAcademicTermIndex(semester: Record<string, unknown>) {
  const academicYear = number(semester.academicYear);
  const termOffset = semesterTermOffset(text(semester.term));
  if (academicYear === undefined || termOffset === null) return null;
  return academicYear * 2 + termOffset;
}

export function relativeTermCodesForRule(rule: Record<string, unknown>) {
  const audience = isRecord(rule.audience) ? rule.audience : {};
  return unique([...textArray(rule.relativeTermCodes), ...textArray(audience.relativeTermCodes)]).map((item) => item.toUpperCase());
}

function duplicated(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

export function defaultStudentActionForClassification(classification: string): BnbuStudentAction {
  if (classification === "unknown") return "recommend_only";
  return autoJoinClassifications.has(classification) ? "default_join" : "searchable_add";
}

export function membershipSourceForClassification(classification: string) {
  if (classification === "major_required") return "auto_major_required";
  if (classification === "faculty_required" || classification === "college_core") return "auto_faculty_required";
  if (classification.startsWith("university_core")) return "auto_university_core";
  if (classification === "concentration_required") return "auto_concentration_required";
  if (classification === "bba_core" || classification === "common_core" || classification === "required_core") return "auto_core_required";
  if (classification === "final_year_project") return "auto_final_year_project";
  if (classification === "internship") return "auto_internship";
  return "auto_required";
}

export function validateBnbuCourseImportPayload(payload: unknown): BnbuValidationSummary {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(payload)) {
    return { ok: false, errors: ["payload must be a JSON object"], warnings, counts: {} };
  }

  const schemaVersion = text(payload.schemaVersion);
  const isV2 = schemaVersion === "teamaking.bnbu_course_import.v2";
  if (!schemaVersionSet.has(schemaVersion)) {
    errors.push("schemaVersion must be teamaking.bnbu_course_import.v1 or teamaking.bnbu_course_import.v2");
  }

  const school = isRecord(payload.school) ? payload.school : null;
  if (!school) errors.push("school is required");
  if (school && text(school.shortName) !== "BNBU") errors.push("school.shortName must be BNBU");

  const semester = isRecord(payload.semester) ? payload.semester : null;
  const semesterCode = semester ? text(semester.code) : "";
  if (!semester) errors.push("semester is required");
  if (semester && !semesterCode) errors.push("semester.code is required");
  if (semester && !text(semester.name)) errors.push("semester.name is required");
  if (semester && typeof semester.academicYear !== "number") errors.push("semester.academicYear must be a number");
  if (semester && !text(semester.term)) errors.push("semester.term is required");
  if (semester && semester.isCurrentCandidate === true) {
    const importTermIndex = semesterAcademicTermIndex(semester);
    const currentTermIndex = currentAcademicTermIndex();
    if (importTermIndex !== null && importTermIndex < currentTermIndex) {
      errors.push("semester.isCurrentCandidate cannot be true for a historical semester");
    }
  }

  const sourceRefs = recordArray(payload.sourceRefs);
  const faculties = recordArray(payload.faculties);
  const majors = recordArray(payload.majors);
  const courses = recordArray(payload.courses);
  const offerings = recordArray(payload.offerings);
  const curriculumRules = recordArray(payload.curriculumRules);

  const sourceIds = sourceRefs.map((item) => text(item.id)).filter(Boolean);
  const facultyCodes = faculties.map((item) => text(item.code)).filter(Boolean);
  const majorCodes = majors.map((item) => text(item.code)).filter(Boolean);
  const courseCodes = courses.map((item) => text(item.code)).filter(Boolean);
  const ruleIds = curriculumRules.map((item) => text(item.id)).filter(Boolean);

  if (sourceRefs.length === 0) warnings.push("sourceRefs is empty; admin review will have weaker traceability");
  if (faculties.length === 0) errors.push("faculties must contain at least one faculty");
  if (majors.length === 0) warnings.push("majors is empty; only allMajors/faculty rules can auto-match users");
  if (courses.length === 0) errors.push("courses must contain at least one course");
  if (offerings.length === 0) {
    if (isV2) {
      // v2 handbook/programme-plan imports are allowed to be cohort curriculum only.
      // Course Boards can be activated from matching rules for the current academic term.
    } else {
      errors.push("offerings must contain at least one offering");
    }
  }
  if (curriculumRules.length === 0) warnings.push("curriculumRules is empty; courses will be searchable only if imported manually later");

  duplicated(sourceIds).forEach((id) => errors.push(`duplicate sourceRef id: ${id}`));
  duplicated(facultyCodes).forEach((code) => errors.push(`duplicate faculty code: ${code}`));
  duplicated(majorCodes).forEach((code) => errors.push(`duplicate major code: ${code}`));
  duplicated(courseCodes).forEach((code) => errors.push(`duplicate course code: ${code}`));
  duplicated(ruleIds).forEach((id) => errors.push(`duplicate curriculumRule id: ${id}`));

  const sourceIdSet = new Set(sourceIds);
  const sourceTypeById = new Map(sourceRefs.map((item) => [text(item.id), text(item.sourceType)]));
  const facultyCodeSet = new Set(facultyCodes);
  const majorCodeSet = new Set(majorCodes);
  const courseCodeSet = new Set(courseCodes);

  sourceRefs.forEach((item, index) => {
    if (!text(item.id)) errors.push(`sourceRefs[${index}].id is required`);
    if (!text(item.title)) errors.push(`sourceRefs[${index}].title is required`);
    if (!text(item.url)) errors.push(`sourceRefs[${index}].url is required`);
  });

  faculties.forEach((item, index) => {
    if (!text(item.code)) errors.push(`faculties[${index}].code is required`);
    if (!text(item.name)) errors.push(`faculties[${index}].name is required`);
  });

  majors.forEach((item, index) => {
    const code = text(item.code);
    const facultyCode = text(item.facultyCode);
    if (!code) errors.push(`majors[${index}].code is required`);
    if (!text(item.name)) errors.push(`majors[${index}].name is required`);
    if (!facultyCode) errors.push(`majors[${index}].facultyCode is required`);
    if (facultyCode && !facultyCodeSet.has(facultyCode)) errors.push(`majors[${index}] references unknown facultyCode: ${facultyCode}`);
  });

  courses.forEach((item, index) => {
    if (!text(item.code)) errors.push(`courses[${index}].code is required`);
    if (!text(item.title)) errors.push(`courses[${index}].title is required`);
    if (item.credits !== undefined && typeof item.credits !== "number") errors.push(`courses[${index}].credits must be a number when present`);
    if (isV2 && (!isRecord(item.ownerUnit) || Object.keys(item.ownerUnit).length === 0)) warnings.push(`courses[${index}].ownerUnit is empty; department/faculty ownership is incomplete`);
    textArray(item.sourceRefIds).forEach((id) => {
      if (!sourceIdSet.has(id)) warnings.push(`courses[${index}] references sourceRefId not listed in sourceRefs: ${id}`);
    });
  });

  offerings.forEach((item, index) => {
    const courseCode = text(item.courseCode);
    if (!courseCode) errors.push(`offerings[${index}].courseCode is required`);
    if (courseCode && !courseCodeSet.has(courseCode)) errors.push(`offerings[${index}] references unknown courseCode: ${courseCode}`);
    const offeringSemesterCode = text(item.semesterCode);
    if (!offeringSemesterCode) errors.push(`offerings[${index}].semesterCode is required`);
    if (offeringSemesterCode && semesterCode && offeringSemesterCode !== semesterCode) errors.push(`offerings[${index}].semesterCode must match semester.code`);
    const offeringSourceIds = textArray(item.sourceRefIds);
    offeringSourceIds.forEach((id) => {
      if (!sourceIdSet.has(id)) warnings.push(`offerings[${index}] references sourceRefId not listed in sourceRefs: ${id}`);
    });
    if (isV2) {
      if (offeringSourceIds.length === 0) {
        errors.push(`offerings[${index}] has no sourceRefIds; timetable/course-list evidence is required`);
      } else {
        const knownTypes = offeringSourceIds.map((id) => sourceTypeById.get(id)).filter((sourceType): sourceType is string => Boolean(sourceType));
        if (knownTypes.length > 0 && knownTypes.every((sourceType) => handbookOnlySourceTypes.has(sourceType))) {
          errors.push(`offerings[${index}] is sourced only from handbook/curriculum sources; offerings must come from timetable or course-list evidence`);
        }
      }
    }
    const syllabus = isRecord(item.syllabus) ? item.syllabus : null;
    if (syllabus) {
      const teamworkRequirement = text(syllabus.teamworkRequirement) || "unknown";
      if (!teamworkRequirementSet.has(teamworkRequirement)) errors.push(`offerings[${index}].syllabus.teamworkRequirement is invalid`);
      if (isV2 && teamworkRequirement === "unknown") warnings.push(`offerings[${index}].syllabus.teamworkRequirement is unknown; syllabus/teamwork evidence is incomplete`);
    } else if (isV2) {
      warnings.push(`offerings[${index}].syllabus is missing; teamwork requirement cannot be evaluated`);
    }
  });

  curriculumRules.forEach((item, index) => {
    const courseCode = text(item.courseCode);
    const classification = text(item.classification);
    const studentAction = text(item.studentAction) || defaultStudentActionForClassification(classification);
    const audience = isRecord(item.audience) ? item.audience : null;
    const relativeTermCodes = relativeTermCodesForRule(item);

    if (!text(item.id)) errors.push(`curriculumRules[${index}].id is required`);
    if (!courseCode) errors.push(`curriculumRules[${index}].courseCode is required`);
    if (courseCode && !courseCodeSet.has(courseCode)) errors.push(`curriculumRules[${index}] references unknown courseCode: ${courseCode}`);
    if (text(item.semesterCode) !== semesterCode) errors.push(`curriculumRules[${index}].semesterCode must match semester.code`);
    if (!classificationSet.has(classification)) errors.push(`curriculumRules[${index}].classification is invalid`);
    if (!studentActionSet.has(studentAction)) errors.push(`curriculumRules[${index}].studentAction is invalid`);
    if (classification === "unknown" && !["recommend_only", "hidden"].includes(studentAction)) {
      errors.push(`curriculumRules[${index}] unknown classification must use recommend_only or hidden`);
    }
    if (text(item.confidence) && !confidenceSet.has(text(item.confidence))) errors.push(`curriculumRules[${index}].confidence is invalid`);
    if (!audience) errors.push(`curriculumRules[${index}].audience is required`);
    relativeTermCodes.forEach((code) => {
      if (!relativeTermCodeIsValid(code)) errors.push(`curriculumRules[${index}].relativeTermCodes contains invalid code: ${code}`);
    });
    textArray(item.sourceRefIds).forEach((id) => {
      if (!sourceIdSet.has(id)) warnings.push(`curriculumRules[${index}] references sourceRefId not listed in sourceRefs: ${id}`);
    });

    if (audience) {
      const ruleMajorCodes = textArray(audience.majorCodes);
      const ruleFacultyCodes = textArray(audience.facultyCodes);
      const ruleGrades = textArray(audience.grades);

      textArray(audience.majorCodes).forEach((code) => {
        if (!majorCodeSet.has(code)) errors.push(`curriculumRules[${index}] references unknown majorCode: ${code}`);
      });
      textArray(audience.facultyCodes).forEach((code) => {
        if (!facultyCodeSet.has(code)) errors.push(`curriculumRules[${index}] references unknown facultyCode: ${code}`);
      });
      const targetsNobody =
        audience.allMajors !== true &&
        ruleMajorCodes.length === 0 &&
        ruleFacultyCodes.length === 0;
      if (targetsNobody) warnings.push(`curriculumRules[${index}] has no audience target; it will not auto-match users`);

      if (programmeScopedClassifications.has(classification)) {
        if (audience.allMajors === true) {
          errors.push(`curriculumRules[${index}] ${classification} must not use allMajors: true`);
        }
        if (ruleMajorCodes.length === 0) {
          errors.push(`curriculumRules[${index}] ${classification} must include audience.majorCodes`);
        }
      }

      if (isV2 && requiredProgrammeScopedClassifications.has(classification) && studentAction === "default_join" && relativeTermCodes.length === 0 && ruleGrades.length === 0) {
        errors.push(`curriculumRules[${index}] ${classification} default_join rule must include relativeTermCodes or grades`);
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      sourceRefs: sourceRefs.length,
      faculties: faculties.length,
      majors: majors.length,
      courses: courses.length,
      offerings: offerings.length,
      curriculumRules: curriculumRules.length
    },
    schemaVersion,
    semesterCode
  };
}

export function normalizedRuleStudentAction(rule: Record<string, unknown>) {
  const classification = text(rule.classification);
  const action = text(rule.studentAction);
  return studentActionSet.has(action) ? action : defaultStudentActionForClassification(classification);
}
