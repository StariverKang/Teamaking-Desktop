import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Admin Audit Logs"
      endpoint="/api/admin/logs"
      defaultActionPath="/api/admin/logs"
      description="查看所有管理端变更记录。"
    />
  );
}
