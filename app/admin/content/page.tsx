import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Content & Announcements"
      endpoint="/api/admin/content"
      description="管理联系开发者、开发日志、帮助中心和全站公告。文档支持文件夹/文档树，公告会继续在全站弹窗提醒未读用户。"
    />
  );
}
