"use client";

import { AdminHomePage } from "@/components/pages/admin/home-page";
import { AdminMaintenancePage } from "@/components/pages/admin/maintenance-page";
import { AdminMetricsPage } from "@/components/pages/admin/metrics-page";
import { AdminResourcePage } from "@/components/pages/admin/resource-page";

export { AdminHomePage, AdminMaintenancePage, AdminMetricsPage };

export function AdminUsersWorkbench() {
  return (
    <AdminResourcePage
      title="Admin Users"
      endpoint="/api/admin/admin-users"
      defaultActionPath="/api/admin/admin-users"
      description="创建、重置和查看正式管理员账号。只有 super_admin 可以操作。"
    />
  );
}

export function BoardsWorkbench() {
  return (
    <AdminResourcePage
      title="Course Board Management"
      endpoint="/api/admin/boards"
      defaultActionPath="/api/admin/boards/BOARD_ID"
      description="管理课程板状态、标题和规则文案。"
    />
  );
}

export function ConfigsWorkbench() {
  return (
    <AdminResourcePage
      title="Site Configuration"
      endpoint="/api/admin/configs"
      defaultActionPath="/api/admin/configs/landing_page"
      description="编辑 onboarding guide、landing page text、course board rules 等配置。"
    />
  );
}

export function ContentWorkbench() {
  return (
    <AdminResourcePage
      title="Content & Announcements"
      endpoint="/api/admin/content"
      description="管理联系开发者、开发日志、帮助中心和全站公告。文档支持文件夹/文档树，公告会继续在全站弹窗提醒未读用户。"
    />
  );
}

export function CourseImportsWorkbench() {
  return (
    <AdminResourcePage
      title="BNBU Course Imports"
      endpoint="/api/admin/course-imports"
      defaultActionPath="/api/admin/course-imports"
      description="上传、校验、审批爬虫清洗后的 BNBU 课程配置 JSON。批准后会创建课程、课程板、课程规则，并按必修/核心规则推荐给匹配学生。"
    />
  );
}

export function CourseSubmissionsWorkbench() {
  return (
    <AdminResourcePage
      title="Course Submission Review"
      endpoint="/api/admin/course-submissions"
      defaultActionPath="/api/admin/course-submissions/SUBMISSION_ID/approve"
      description="审核用户提交的缺失课程，可以 approve、reject 或 merge。"
    />
  );
}

export function CoursesWorkbench() {
  return (
    <AdminResourcePage
      title="Course Management"
      endpoint="/api/admin/courses"
      defaultActionPath="/api/admin/courses"
      description="管理课程基础信息，并保留课程合并接口。"
    />
  );
}

export function ErrorEventsWorkbench() {
  return (
    <AdminResourcePage
      title="Error Events"
      endpoint="/api/admin/error-events"
      defaultActionPath="/api/admin/error-events"
      description="按 errorCode、requestId、userId 或 path 查询运行时错误。"
    />
  );
}

export function LogsWorkbench() {
  return (
    <AdminResourcePage
      title="Admin Audit Logs"
      endpoint="/api/admin/logs"
      defaultActionPath="/api/admin/logs"
      description="查看所有管理端变更记录。"
    />
  );
}

export function MajorsWorkbench() {
  return (
    <AdminResourcePage
      title="Faculty, Major, Grade Management"
      endpoint="/api/admin/majors"
      defaultActionPath="/api/admin/majors"
      description="管理 Faculty、Major 和 Semester。POST body 中用 type=faculty、major 或 semester 区分。"
    />
  );
}

export function SchoolsWorkbench() {
  return (
    <AdminResourcePage
      title="School Management"
      endpoint="/api/admin/schools"
      defaultActionPath="/api/admin/schools"
      description="管理学校、学校简称和邮箱域名。创建学校时 body 可以包含 domains 数组。"
    />
  );
}

export function SupportTicketsWorkbench() {
  return (
    <AdminResourcePage
      title="Support Tickets"
      endpoint="/api/admin/support-tickets"
      defaultActionPath="/api/admin/support-tickets/TICKET_ID"
      description="处理缺失课程、bug、报错和后台需求。"
    />
  );
}

export function TeamUpRequestsWorkbench() {
  return (
    <AdminResourcePage
      title="Reported Team Up Requests"
      endpoint="/api/admin/team-up-requests/reported"
      defaultActionPath="/api/admin/team-up-requests/REQUEST_ID"
      description="查看和处理 reported Team Up Requests。"
    />
  );
}

export function TeamakingPostsWorkbench() {
  return (
    <AdminResourcePage
      title="Teamaking Post Moderation"
      endpoint="/api/admin/teamaking-posts"
      defaultActionPath="/api/admin/teamaking-posts/POST_ID"
      description="管理 Open to Team 信号的状态，不引入队长或申请流程。"
    />
  );
}

export function UsersWorkbench() {
  return (
    <AdminResourcePage
      title="User Management"
      endpoint="/api/admin/users"
      defaultActionPath="/api/admin/users/USER_ID"
      description="管理用户角色、onboarding 状态和已验证账号。"
    />
  );
}

export function VersionsWorkbench() {
  return (
    <AdminResourcePage
      title="Software Versions"
      endpoint="/api/admin/versions"
      defaultActionPath="/api/admin/versions"
      description="管理测试/正式版本、数据库状态检查点和版本日志。开启新版本会关闭当前版本，并让普通用户、课程、学期和导入数据从空白开始。"
    />
  );
}
