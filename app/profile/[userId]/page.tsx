import { PublicProfilePage } from "@/components/pages/profile/public-profile-page";

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <PublicProfilePage userId={userId} />;
}
