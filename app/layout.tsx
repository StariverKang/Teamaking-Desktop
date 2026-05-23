import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "TEAMAKING",
  description: "Proof-of-Work Profile + Course Boards + Open-to-Team Signals"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
