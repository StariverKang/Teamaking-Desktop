import { PublicProfilePage } from "@/components/client-pages";

export default function Page({ params }: { params: { userId: string } }) {
  return <PublicProfilePage userId={params.userId} />;
}
