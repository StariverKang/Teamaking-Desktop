import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Course Board Management"
      endpoint="/api/admin/boards"
      defaultActionPath="/api/admin/boards/BOARD_ID"
      description="管理课程板状态、标题和规则文案。"
    />
  );
}
