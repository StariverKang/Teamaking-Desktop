import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="User Management"
      endpoint="/api/admin/users"
      defaultActionPath="/api/admin/users/USER_ID"
      description="管理用户角色、onboarding 状态和已验证账号。"
    />
  );
}
