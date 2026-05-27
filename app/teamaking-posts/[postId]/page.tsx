import { TeamakingPostPage } from "@/components/pages/course-board-pages";

export default async function Page({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <TeamakingPostPage postId={postId} />;
}
