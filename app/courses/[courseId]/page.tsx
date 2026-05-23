import { CourseDetailPage } from "@/components/client-pages";

export default function Page({ params }: { params: { courseId: string } }) {
  return <CourseDetailPage courseId={params.courseId} />;
}
