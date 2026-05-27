"use client";

import { Settings } from "lucide-react";
import { Card, PageShell } from "@/components/app-shell";

export function AdminHomePage() {
  return (
    <PageShell title="Admin Dashboard" eyebrow="Admin" description="管理用户、学校、课程、课程提交、Course Boards、Teamaking Posts、Team Up Requests 和站点配置。" aside="admin">
      <div className="grid gap-4 md:grid-cols-3">
        {["Users & Roles", "Admin Users", "Schools & Domains", "Course Boards", "Support Tickets", "Metrics", "Maintenance", "Site Configs", "Audit Logs", "Error Events"].map((item) => (
          <Card key={item}>
            <Settings size={20} aria-hidden className="text-coral" />
            <h2 className="mt-3 font-semibold text-ink">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/62">所有管理端变更都会写入 AdminAuditLog。</p>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
