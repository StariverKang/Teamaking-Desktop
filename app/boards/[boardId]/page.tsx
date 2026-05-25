import { BoardPage } from "@/components/client-pages";

export default async function Page({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <BoardPage boardId={boardId} />;
}
