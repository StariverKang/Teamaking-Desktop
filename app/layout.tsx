import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/app-shell";
import { AnnouncementCenter } from "@/components/announcement-center";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SupportWidget } from "@/components/pages/student-pages";
import { LanguageRuntime } from "@/components/language-runtime";
import { SiteCopyRuntime } from "@/components/site-copy-runtime";
import { FeedbackProvider } from "@/components/feedback-provider";

export const metadata: Metadata = {
  title: "TEAMAKING",
  description: "Proof-of-Work Profile + Course Boards + Open-to-Team Signals"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <LanguageRuntime>
          <FeedbackProvider>
            <SiteCopyRuntime>
              <Navbar />
              <AnnouncementCenter />
              <OnboardingTour />
              {children}
              <SupportWidget />
            </SiteCopyRuntime>
          </FeedbackProvider>
        </LanguageRuntime>
      </body>
    </html>
  );
}
