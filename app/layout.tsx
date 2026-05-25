import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/app-shell";
import { AnnouncementCenter } from "@/components/announcement-center";
import { SupportWidget } from "@/components/client-pages";
import { LanguageRuntime } from "@/components/language-runtime";

export const metadata: Metadata = {
  title: "TEAMAKING",
  description: "Proof-of-Work Profile + Course Boards + Open-to-Team Signals"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <LanguageRuntime>
          <Navbar />
          <AnnouncementCenter />
          {children}
          <SupportWidget />
        </LanguageRuntime>
      </body>
    </html>
  );
}
