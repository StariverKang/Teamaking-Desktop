import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Course Management"
      endpoint="/api/admin/courses"
      defaultActionPath="/api/admin/courses"
      description="管理课程基础信息，并保留课程合并接口。"
    />
  );
}
