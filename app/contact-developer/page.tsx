import { ContactDeveloperPage } from "@/components/pages/content-pages";
import { getPublicContentPayload } from "@/lib/server/services/content-service";

export default async function Page() {
  const initialData = await getPublicContentPayload("developer_contact");
  return <ContactDeveloperPage initialData={initialData} />;
}
