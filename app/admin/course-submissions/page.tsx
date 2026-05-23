import { AdminResourcePage } from "@/components/client-pages";

export default function Page() {
  return (
    <AdminResourcePage
      title="Course Submission Review"
      endpoint="/api/admin/course-submissions"
      defaultActionPath="/api/admin/course-submissions/SUBMISSION_ID/approve"
      description="审核用户提交的缺失课程，可以 approve、reject 或 merge。"
    />
  );
}
