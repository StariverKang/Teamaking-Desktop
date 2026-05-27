import { BoardPage } from "@/components/pages/course-board-pages";

export default async function Page({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <BoardPage boardId={boardId} />;
}
