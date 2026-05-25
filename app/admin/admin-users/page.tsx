import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Admin Users"
      endpoint="/api/admin/admin-users"
      defaultActionPath="/api/admin/admin-users"
      description="创建、重置和查看正式管理员账号。只有 super_admin 可以操作。"
    />
  );
}
