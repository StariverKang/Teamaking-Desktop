import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Error Events"
      endpoint="/api/admin/error-events"
      defaultActionPath="/api/admin/error-events"
      description="按 errorCode、requestId、userId 或 path 查询运行时错误。"
    />
  );
}
