import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="School Management"
      endpoint="/api/admin/schools"
      defaultActionPath="/api/admin/schools"
      description="管理学校、学校简称和邮箱域名。创建学校时 body 可以包含 domains 数组。"
    />
  );
}
