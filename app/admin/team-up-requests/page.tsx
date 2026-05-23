import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Reported Team Up Requests"
      endpoint="/api/admin/team-up-requests/reported"
      defaultActionPath="/api/admin/team-up-requests/REQUEST_ID"
      description="查看和处理 reported Team Up Requests。"
    />
  );
}
