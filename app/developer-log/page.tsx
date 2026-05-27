import { ContentDocumentsPage } from "@/components/pages/content-pages";

export default function Page() {
  return (
    <ContentDocumentsPage
      kind="developer_log"
      title="开发者日志"
      eyebrow="Developer Log"
      description="查看开发者发布的版本说明、变更记录和后续计划。"
    />
  );
}
