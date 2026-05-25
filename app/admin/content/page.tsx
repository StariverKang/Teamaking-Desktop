import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Content Documents"
      endpoint="/api/admin/content"
      description="管理帮助中心、开发者日志和联系开发者文档。支持 Markdown、父子级、发布/隐藏和最多三张日志图片。"
    />
  );
}
