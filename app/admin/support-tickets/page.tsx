import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Support Tickets"
      endpoint="/api/admin/support-tickets"
      defaultActionPath="/api/admin/support-tickets/TICKET_ID"
      description="处理缺失课程、bug、报错和后台需求。"
    />
  );
}
