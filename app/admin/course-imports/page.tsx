import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="BNBU Course Imports"
      endpoint="/api/admin/course-imports"
      defaultActionPath="/api/admin/course-imports"
      description="上传、校验、审批爬虫清洗后的 BNBU 课程配置 JSON。批准后会创建课程、课程板、课程规则，并按必修/核心规则默认加入匹配学生。"
    />
  );
}
