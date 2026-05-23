import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Teamaking Post Moderation"
      endpoint="/api/admin/teamaking-posts"
      defaultActionPath="/api/admin/teamaking-posts/POST_ID"
      description="管理 Open to Team 信号的状态，不引入队长或申请流程。"
    />
  );
}
