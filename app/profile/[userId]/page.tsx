import { PublicProfilePage } from "@/components/client-pages";

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <PublicProfilePage userId={userId} />;
}
