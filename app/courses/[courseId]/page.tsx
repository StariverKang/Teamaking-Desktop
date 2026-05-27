import { CourseDetailPage } from "@/components/pages/course-board-pages";

export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseDetailPage courseId={courseId} />;
}
