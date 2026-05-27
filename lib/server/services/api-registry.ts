
import { createApiModuleRegistry } from "@/lib/server/api-module-registry";
import { createAdminVersionsModule, isAdminVersionsPath } from "@/lib/server/admin/versions-module";
import { createCrawlerModule } from "@/lib/server/crawler/module";
import { createCourseImportAdminModule, isCourseImportAdminPath } from "@/lib/server/course-import/admin-module";
import { createCourseImportWorkflow } from "@/lib/server/course-import/workflow";
import { prisma } from "@/lib/prisma";
import { getActiveAppVersionId } from "@/lib/app-version";
import { operationLog } from "@/lib/server/services/system-service";

export const BNBU_PROGRAMMES_URL = "https://www.bnbu.edu.cn/en/faculties_and_schools.htm";

export const BNBU_HANDBOOK_URL = "https://ar.bnbu.edu.cn/current_students/student_handbook/programme_handbook.htm";

export const BNBU_COURSE_DESCRIPTIONS_URL = "https://ar.bnbu.edu.cn/info/1021/1430.htm";

export const BNBU_MIS_URL = "https://mis.bnbu.edu.cn";

export const courseImportWorkflow = createCourseImportWorkflow();

export const handleCrawlerModule = createCrawlerModule({
  prisma,
  defaults: {
    handbookUrl: BNBU_HANDBOOK_URL,
    courseDescriptionsUrl: BNBU_COURSE_DESCRIPTIONS_URL,
    academicYear: "2026",
    term: "Spring"
  },
  getActiveAppVersionId,
  operationLog,
  courseImportWorkflow
});

export const handleCourseImportAdminModule = createCourseImportAdminModule({
  workflow: courseImportWorkflow
});

export const handleAdminVersionsModule = createAdminVersionsModule();

export const apiModuleRegistry = createApiModuleRegistry([
  {
    name: "admin/course-imports",
    matches: (context) => isCourseImportAdminPath(context.path),
    handler: handleCourseImportAdminModule
  },
  {
    name: "admin/versions",
    matches: (context) => isAdminVersionsPath(context.path),
    handler: handleAdminVersionsModule
  },
  {
    name: "crawler",
    matches: (context) => context.path[0] === "crawler",
    handler: handleCrawlerModule
  }
]);
