import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Software Versions"
      endpoint="/api/admin/versions"
      defaultActionPath="/api/admin/versions"
      description="管理测试/正式版本、数据库状态检查点和版本日志。开启新版本会关闭当前版本，并让普通用户、课程、学期和导入数据从空白开始。"
    />
  );
}
