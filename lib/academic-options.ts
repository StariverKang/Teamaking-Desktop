type MajorLike = {
  id?: string;
  code?: string | null;
  name?: string | null;
  facultyId?: string | null;
};

type LegacyMajorReplacement = {
  code: string;
  canonicalNames: string[];
};

export const legacyBnbuMajorReplacements: Record<string, LegacyMajorReplacement> = {
  "Applied Translation": {
    code: "ATS",
    canonicalNames: ["Applied Translation Studies Programme"]
  },
  "Applied Translation Studies": {
    code: "ATS",
    canonicalNames: ["Applied Translation Studies Programme"]
  },
  "Computer Science": {
    code: "CST",
    canonicalNames: ["Computer Science and Technology Programme"]
  },
  "English Language and Literary Studies": {
    code: "ELLS",
    canonicalNames: ["English Language and Literature Studies Programme"]
  },
  "English Language and Literature Studies": {
    code: "ELLS",
    canonicalNames: ["English Language and Literature Studies Programme"]
  },
  Finance: {
    code: "FIN",
    canonicalNames: ["Finance Programme"]
  },
  Marketing: {
    code: "MKT",
    canonicalNames: ["Marketing Management Programme"]
  },
  "Media and Communication": {
    code: "MCOM",
    canonicalNames: ["Media and Communication Studies Programme"]
  },
  "Public Relations and Advertising": {
    code: "PRA",
    canonicalNames: ["Public Relations and Advertising Programme"]
  }
};

const legacyBnbuMajorNames = new Set(Object.keys(legacyBnbuMajorReplacements));

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanCode(value: unknown) {
  return cleanText(value).toUpperCase();
}

export function legacyBnbuMajorReplacementForName(name: unknown) {
  return legacyBnbuMajorReplacements[cleanText(name)] ?? null;
}

export function isLegacyBnbuMajorName(name: unknown) {
  return legacyBnbuMajorNames.has(cleanText(name));
}

function hasCanonicalReplacement<T extends MajorLike>(legacyMajor: T, majors: T[], replacement: LegacyMajorReplacement) {
  return majors.some((candidate) => {
    if (candidate === legacyMajor) return false;
    if (candidate.id && legacyMajor.id && candidate.id === legacyMajor.id) return false;
    if (isLegacyBnbuMajorName(candidate.name)) return false;
    const candidateCode = cleanCode(candidate.code);
    if (candidateCode && candidateCode === replacement.code) return true;
    return replacement.canonicalNames.includes(cleanText(candidate.name));
  });
}

export function filterUserFacingMajors<T extends MajorLike>(majors: T[]) {
  return majors.filter((major) => {
    const replacement = legacyBnbuMajorReplacementForName(major.name);
    if (!replacement) return true;
    return !hasCanonicalReplacement(major, majors, replacement);
  });
}

export async function mergeLegacyBnbuMajorAliases(
  tx: any,
  schoolId: string,
  canonicalMajorByCode: Map<string, { id: string; facultyId: string }> = new Map()
) {
  const legacyMajors = await tx.major.findMany({
    where: { schoolId, name: { in: [...legacyBnbuMajorNames] } },
    select: { id: true, name: true, code: true, facultyId: true }
  });
  const merged: Array<{ fromName: string; toCode: string; profilesMoved: number; mappingsMoved: number }> = [];

  for (const legacyMajor of legacyMajors) {
    const replacement = legacyBnbuMajorReplacementForName(legacyMajor.name);
    if (!replacement) continue;
    const canonical =
      canonicalMajorByCode.get(replacement.code) ??
      (await tx.major.findFirst({
        where: {
          schoolId,
          code: replacement.code,
          NOT: { id: legacyMajor.id }
        },
        select: { id: true, facultyId: true }
      }));
    if (!canonical || canonical.id === legacyMajor.id) continue;

    const mappings = await tx.courseMajorMapping.findMany({ where: { majorId: legacyMajor.id } });
    let mappingsMoved = 0;
    for (const mapping of mappings) {
      const existing = await tx.courseMajorMapping.findUnique({
        where: {
          courseId_majorId_recommendedGrade: {
            courseId: mapping.courseId,
            majorId: canonical.id,
            recommendedGrade: mapping.recommendedGrade
          }
        }
      });
      if (existing) {
        await tx.courseMajorMapping.update({
          where: { id: existing.id },
          data: {
            isRequired: existing.isRequired || mapping.isRequired,
            isDefaultRecommended: existing.isDefaultRecommended || mapping.isDefaultRecommended
          }
        });
      } else {
        await tx.courseMajorMapping.create({
          data: {
            courseId: mapping.courseId,
            majorId: canonical.id,
            recommendedGrade: mapping.recommendedGrade,
            isRequired: mapping.isRequired,
            isDefaultRecommended: mapping.isDefaultRecommended
          }
        });
      }
      mappingsMoved += 1;
    }

    await tx.courseMajorMapping.deleteMany({ where: { majorId: legacyMajor.id } });
    const profilesMoved = await tx.userProfile.updateMany({
      where: { majorId: legacyMajor.id },
      data: { majorId: canonical.id, facultyId: canonical.facultyId }
    });
    await tx.major.delete({ where: { id: legacyMajor.id } });
    merged.push({
      fromName: legacyMajor.name,
      toCode: replacement.code,
      profilesMoved: profilesMoved.count,
      mappingsMoved
    });
  }

  return merged;
}
