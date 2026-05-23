import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Site Configuration"
      endpoint="/api/admin/configs"
      defaultActionPath="/api/admin/configs/landing_page"
      description="编辑 onboarding guide、landing page text、course board rules 等配置。"
    />
  );
}
