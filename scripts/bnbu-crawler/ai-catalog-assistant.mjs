import OpenAI from "openai";

const DEFAULT_AI_TIMEOUT_MS = 25000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2000;

export const HANDLER_MAX_COURSES_FOR_AI = 180;

const allowedModes = new Set(["off", "enrich", "validate", "strict"]);
const allowedClassifications = new Set([
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
]);
const allowedStudentActions = new Set(["default_join", "searchable_add", "recommend_only", "hidden"]);
const allowedConfidence = new Set(["high", "medium", "low", "unknown"]);
const allowedOwnerTypes = new Set(["faculty", "school"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value) {
  return asArray(value).map((value) => textValue(value)).filter(Boolean);
}

function dedupeStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = textValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function parseJson(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function intValue(value, fallback = undefined) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : fallback;
}

function numberValue(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeAiMode(value) {
  const normalized = textValue(value).toLowerCase();
  return allowedModes.has(normalized) ? normalized : "off";
}

function normalizeOwnerUnit(value) {
  if (!isRecord(value)) return null;
  const type = textValue(value.type);
  const code = textValue(value.code);
  const name = textValue(value.name);
  if (!allowedOwnerTypes.has(type) || !code || !name) return null;
  return { type, code, name };
}

function buildResponseSchema(target) {
  return {
    type: "json_schema",
    name: target === "course_catalog" ? "teamaking_bnbu_course_catalog_ai_assist_v1" : "teamaking_bnbu_handbook_ai_assist_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status", "fieldsFixed", "invalidCount", "errors", "warnings", "courses", "curriculumRules"],
      properties: {
        status: {
          type: "string",
          enum: ["ok", "warning", "failed", "disabled", "off"]
        },
        fieldsFixed: { type: "integer", minimum: 0 },
        invalidCount: { type: "integer", minimum: 0 },
        errors: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        courses: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["code", "description", "credits", "categoryTags", "ownerUnit"],
            properties: {
              code: { type: "string" },
              description: { type: "string" },
              credits: { type: "number" },
              categoryTags: { type: "array", items: { type: "string" } },
              ownerUnit: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["type", "code", "name"],
                    properties: {
                      type: { type: "string", enum: [...allowedOwnerTypes] },
                      code: { type: "string" },
                      name: { type: "string" }
                    }
                  },
                  { type: "null" }
                ]
              }
            }
          }
        },
        curriculumRules: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "classification", "classificationLabel", "studentAction", "confidence"],
            properties: {
              id: { type: "string" },
              classification: { type: "string", enum: [...allowedClassifications] },
              classificationLabel: { type: "string" },
              studentAction: { type: "string", enum: [...allowedStudentActions] },
              confidence: { type: "string", enum: [...allowedConfidence] }
            }
          }
        }
      }
    }
  };
}

function normalizeSummary(raw, mode, model, target) {
  const status = textValue(raw?.status) || "warning";
  const summary = {
    status,
    mode,
    model: textValue(raw?.model) || model,
    fieldsFixed: Math.max(intValue(raw?.fieldsFixed, 0), 0),
    filledCount: Math.max(intValue(raw?.fieldsFixed, 0), 0),
    invalidCount: Math.max(intValue(raw?.invalidCount, 0), 0),
    errors: dedupeStrings(asArray(raw?.errors).map(String).map(textValue).filter(Boolean)),
    warnings: dedupeStrings(asArray(raw?.warnings).map(String).map(textValue).filter(Boolean)),
    rawWarnings: [],
    target,
    courses: asArray(raw?.courses)
      .map((item) => {
        if (!isRecord(item)) return null;
        const code = textValue(item.code).toUpperCase();
        if (!code) return null;
        return {
          code,
          description: textValue(item.description),
          credits: numberValue(item.credits),
          categoryTags: asStringArray(item.categoryTags),
          ownerUnit: normalizeOwnerUnit(item.ownerUnit)
        };
      })
      .filter(Boolean),
    curriculumRules: asArray(raw?.curriculumRules)
      .map((item) => {
        if (!isRecord(item)) return null;
        return {
          id: textValue(item.id),
          classification: textValue(item.classification),
          classificationLabel: textValue(item.classificationLabel),
          studentAction: textValue(item.studentAction),
          confidence: textValue(item.confidence)
        };
      })
      .filter((item) => item.id)
      .filter(Boolean)
  };

  summary.rawWarnings = [...summary.warnings];
  return summary;
}

function summarizeMissings(payload, target) {
  const courses = asArray(payload?.courses);
  const rules = asArray(payload?.curriculumRules);
  const missingCourses = [];
  for (const course of courses) {
    const code = textValue(course?.code).toUpperCase();
    if (!code) continue;
    const missing = [];
    if (!textValue(course.title)) missing.push("title");
    if (!textValue(course.description)) missing.push("description");
    if (!Number.isFinite(numberValue(course.credits)) || numberValue(course.credits) <= 0) missing.push("credits");
    if (!asStringArray(course.categoryTags).length) missing.push("categoryTags");
    if (!normalizeOwnerUnit(course.ownerUnit)) missing.push("ownerUnit");
    if (missing.length) {
      missingCourses.push({ code, title: textValue(course.title), missingFields: missing, sample: textValue(course.description).slice(0, 120) });
    }
  }

  const missingRules = [];
  if (target === "programme_handbook") {
    for (const rule of rules) {
      const id = textValue(rule?.id);
      if (!id) continue;
      const missing = [];
      if (!allowedClassifications.has(textValue(rule.classification))) missing.push("classification");
      if (!allowedStudentActions.has(textValue(rule.studentAction))) missing.push("studentAction");
      if (!allowedConfidence.has(textValue(rule.confidence))) missing.push("confidence");
      if (missing.length) missingRules.push({ id, missingFields: missing });
    }
  }

  return {
    target,
    coursesCount: courses.length,
    rulesCount: rules.length,
    sampleCourses: missingCourses.slice(0, HANDLER_MAX_COURSES_FOR_AI),
    sampleRules: missingRules.slice(0, HANDLER_MAX_COURSES_FOR_AI)
  };
}

function countInvalidCritical(payload, target) {
  let invalid = 0;
  for (const course of asArray(payload?.courses)) {
    if (!textValue(course?.code)) invalid += 1;
    if (!textValue(course?.title)) invalid += 1;
    if (!normalizeOwnerUnit(course?.ownerUnit)) invalid += 1;
    if (!Number.isFinite(numberValue(course?.credits)) || numberValue(course.credits) <= 0) invalid += 1;
  }
  if (target === "programme_handbook") {
    for (const rule of asArray(payload?.curriculumRules)) {
      if (!allowedClassifications.has(textValue(rule?.classification))) invalid += 1;
      if (!allowedStudentActions.has(textValue(rule?.studentAction))) invalid += 1;
      if (!allowedConfidence.has(textValue(rule?.confidence))) invalid += 1;
    }
  }
  return invalid;
}

function mergeCoursePatches(payload, summary, target) {
  const output = JSON.parse(JSON.stringify(payload));
  const byCode = new Map();
  const courses = asArray(output?.courses);
  for (let index = 0; index < courses.length; index += 1) {
    const code = textValue(courses[index]?.code).toUpperCase();
    if (code) byCode.set(code, index);
  }

  const byRule = new Map();
  const rules = asArray(output?.curriculumRules);
  for (let index = 0; index < rules.length; index += 1) {
    const id = textValue(rules[index]?.id);
    if (id) byRule.set(id, index);
  }

  const nextSummary = {
    ...summary,
    fieldsFixed: 0,
    filledCount: 0,
    errors: [...summary.errors],
    warnings: [...summary.warnings],
    rawWarnings: [...summary.rawWarnings]
  };

  for (const patch of summary.courses) {
    const idx = byCode.get(patch.code);
    if (idx === undefined) {
      nextSummary.warnings.push(`AI return unknown course code ${patch.code}`);
      continue;
    }
    const course = courses[idx];

    if (!textValue(course.description) && patch.description) {
      course.description = patch.description;
      nextSummary.fieldsFixed += 1;
    }
    if ((!Number.isFinite(numberValue(course.credits)) || numberValue(course.credits) <= 0) && Number.isFinite(patch.credits) && patch.credits > 0) {
      course.credits = patch.credits;
      nextSummary.fieldsFixed += 1;
    }
    if (!asStringArray(course.categoryTags).length && patch.categoryTags.length) {
      course.categoryTags = dedupeStrings(patch.categoryTags);
      nextSummary.fieldsFixed += 1;
    }
    if (!normalizeOwnerUnit(course.ownerUnit) && patch.ownerUnit) {
      course.ownerUnit = patch.ownerUnit;
      nextSummary.fieldsFixed += 1;
    }
  }

  if (target === "programme_handbook") {
    for (const patch of summary.curriculumRules) {
      const idx = byRule.get(patch.id);
      if (idx === undefined) {
        nextSummary.warnings.push(`AI return unknown rule id ${patch.id}`);
        continue;
      }
      const rule = rules[idx];
      if (!textValue(rule.classification) && allowedClassifications.has(patch.classification)) {
        rule.classification = patch.classification;
        nextSummary.fieldsFixed += 1;
      }
      if (!textValue(rule.classificationLabel) && patch.classificationLabel) {
        rule.classificationLabel = patch.classificationLabel;
        nextSummary.fieldsFixed += 1;
      }
      if (!textValue(rule.studentAction) && allowedStudentActions.has(patch.studentAction)) {
        rule.studentAction = patch.studentAction;
        nextSummary.fieldsFixed += 1;
      }
      if (!textValue(rule.confidence) && allowedConfidence.has(patch.confidence)) {
        rule.confidence = patch.confidence;
        nextSummary.fieldsFixed += 1;
      }
    }
  }

  nextSummary.filledCount = nextSummary.fieldsFixed;
  nextSummary.invalidCount = countInvalidCritical(output, target);
  nextSummary.warnings = dedupeStrings(nextSummary.warnings);
  nextSummary.errors = dedupeStrings(nextSummary.errors);
  nextSummary.rawWarnings = dedupeStrings(nextSummary.rawWarnings.concat(nextSummary.warnings));

  return { payload: output, summary: nextSummary };
}

function buildFailure(mode, model, target, status, reason) {
  return {
    status,
    mode,
    model,
    fieldsFixed: 0,
    filledCount: 0,
    invalidCount: status === "failed" ? 1 : 0,
    errors: status === "failed" ? dedupeStrings([reason]) : [],
    warnings: status === "disabled" ? [] : dedupeStrings([reason]),
    rawWarnings: status === "disabled" ? [] : dedupeStrings([reason]),
    courses: [],
    curriculumRules: [],
    target
  };
}

function buildAiInput(target, payload) {
  const summary = summarizeMissings(payload, target);
  const courses = asArray(payload.courses).map((course) => ({
    code: textValue(course?.code).toUpperCase(),
    title: textValue(course?.title),
    credits: numberValue(course?.credits),
    description: textValue(course?.description).slice(0, 260),
    categoryTags: asStringArray(course?.categoryTags),
    ownerUnit: normalizeOwnerUnit(course?.ownerUnit),
    sourceRefIds: asArray(course?.sourceRefIds)
  }));

  return JSON.stringify({
    target,
    counts: {
      courseCount: courses.length,
      missingCourses: summary.sampleCourses.length,
      ruleCount: summary.rulesCount
    },
    missingSamples: {
      courses: summary.sampleCourses,
      curriculumRules: summary.sampleRules
    },
    courses: courses.slice(0, HANDLER_MAX_COURSES_FOR_AI)
  }, null, 2);
}

export async function applyCrawlerAiAssist(params) {
  const {
    target,
    payload,
    mode: requestedMode = "off",
    enabled = true,
    provider = "openai",
    model: requestedModel = "gpt-4.1-mini",
    apiKey = "",
    timeoutMs = DEFAULT_AI_TIMEOUT_MS,
    maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
    strictMode = false
  } = params ?? {};

  const mode = normalizeAiMode(requestedMode);
  const model = textValue(requestedModel) || "gpt-4.1-mini";

  if (!isRecord(payload)) {
    return {
      payload,
      summary: buildFailure(mode, model, target, "failed", "payload is invalid")
    };
  }

  if (mode === "off") {
    return {
      payload,
      summary: {
        status: "off",
        mode,
        model,
        fieldsFixed: 0,
        filledCount: 0,
        invalidCount: 0,
        errors: [],
        warnings: [],
        rawWarnings: [],
        courses: [],
        curriculumRules: [],
        target
      }
    };
  }

  if (!enabled) {
    return {
      payload,
      summary: buildFailure(mode, model, target, "disabled", "Crawler AI is disabled in admin config")
    };
  }

  if (provider !== "openai") {
    return {
      payload,
      summary: buildFailure(mode, model, target, "failed", `unsupported provider: ${provider}`)
    };
  }

  if (!apiKey) {
    return {
      payload,
      summary: buildFailure(mode, model, target, "disabled", "OpenAI API key missing")
    };
  }

  const requestInput = buildAiInput(target, payload);
  const instruction = [
    "你是 TEAMAKING 的课程导入 AI 助理。",
    "只返回 JSON，且只补齐课程或规则中的缺失字段。",
    "严禁改写已存在且非空的有效字段。",
    "禁止猜测课程代码；规则 id 必须与输入一致。",
    "categoryTags 是字符串数组。"
  ].join(" ");

  const client = new OpenAI({ apiKey, timeout: intValue(timeoutMs, DEFAULT_AI_TIMEOUT_MS) });

  let raw;
  try {
    const response = await client.responses.create({
      model,
      max_output_tokens: intValue(maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS),
      instructions: instruction,
      input: [
        `Target: ${target}`,
        `Mode: ${mode}`,
        requestInput
      ].join("\n"),
      text: {
        format: buildResponseSchema(target)
      }
    });
    raw = parseJson(response.output_text);
  } catch (error) {
    return {
      payload,
      summary: buildFailure(
        mode,
        model,
        target,
        "failed",
        `OpenAI request failed: ${error instanceof Error ? error.message : "unknown"}`
      )
    };
  }

  if (!raw) {
    return {
      payload,
      summary: buildFailure(mode, model, target, "failed", "AI output is not valid JSON")
    };
  }

  const summary = normalizeSummary(raw, mode, model, target);
  summary.invalidCount = Math.max(summary.invalidCount, countInvalidCritical(payload, target));

  if (mode === "validate") {
    summary.status = summary.invalidCount || summary.errors.length ? "warning" : "ok";
    summary.fieldsFixed = 0;
    summary.filledCount = 0;
    return { payload, summary };
  }

  const merged = mergeCoursePatches(payload, summary, target);
  const strictRequested = strictMode || mode === "strict";
  merged.summary.status = strictRequested
    ? (merged.summary.invalidCount || merged.summary.errors.length ? "failed" : "ok")
    : (merged.summary.errors.length ? "warning" : "ok");
  merged.summary.invalidCount = Math.max(merged.summary.invalidCount, 0);

  return merged;
}
