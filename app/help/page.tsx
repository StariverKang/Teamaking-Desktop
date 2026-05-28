import { ContentDocumentsPage } from "@/components/pages/content-pages";
import { getPublicContentPayload } from "@/lib/server/services/content-service";

export default async function Page() {
  const initialData = await getPublicContentPayload("help");
  return (
    <ContentDocumentsPage
      kind="help"
      title="帮助中心"
      eyebrow="Help"
      description="查看平台功能说明、常见问题和管理员发布的使用文档。"
      initialData={initialData}
    />
  );
}
