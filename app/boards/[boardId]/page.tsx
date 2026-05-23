import { BoardPage } from "@/components/client-pages";

export default function Page({ params }: { params: { boardId: string } }) {
  return <BoardPage boardId={params.boardId} />;
}
