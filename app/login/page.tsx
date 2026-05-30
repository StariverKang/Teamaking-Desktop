import { LoginPage } from "@/components/pages/auth-pages";
import { loginModeFromValue } from "@/lib/login-mode";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  return <LoginPage initialMode={loginModeFromValue(rawMode)} />;
}
