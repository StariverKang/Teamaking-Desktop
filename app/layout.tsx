import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/app-shell";
import { AnnouncementCenter } from "@/components/announcement-center";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SupportWidget } from "@/components/pages/student-pages";
import { LanguageRuntime } from "@/components/language-runtime";
import { SiteCopyRuntime } from "@/components/site-copy-runtime";

export const metadata: Metadata = {
  title: "TEAMAKING",
  description: "Proof-of-Work Profile + Course Boards + Open-to-Team Signals"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <LanguageRuntime>
          <SiteCopyRuntime>
            <Navbar />
            <AnnouncementCenter />
            <OnboardingTour />
            {children}
            <SupportWidget />
          </SiteCopyRuntime>
        </LanguageRuntime>
      </body>
    </html>
  );
}
