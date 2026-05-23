import { TeamakingPostPage } from "@/components/client-pages";

export default function Page({ params }: { params: { postId: string } }) {
  return <TeamakingPostPage postId={params.postId} />;
}
