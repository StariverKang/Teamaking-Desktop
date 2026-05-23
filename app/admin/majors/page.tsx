import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Faculty, Major, Grade Management"
      endpoint="/api/admin/majors"
      defaultActionPath="/api/admin/majors"
      description="管理 Faculty、Major 和 Semester。POST body 中用 type=faculty、major 或 semester 区分。"
    />
  );
}
