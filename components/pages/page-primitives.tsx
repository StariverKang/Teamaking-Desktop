"use client";

import { EditableCopy } from "@/components/site-copy-runtime";
import clsx from "clsx";

export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="border border-coral/35 bg-coral/10 px-4 py-3 text-sm text-coral">{message}</div>;
}

export function InlineFeedback({ message, tone = "success" }: { message?: string; tone?: "success" | "error" | "info" }) {
  if (!message) return null;
  return (
    <p
      className={clsx(
        "border px-3 py-2 text-sm font-medium leading-6",
        tone === "success" && "border-forest/25 bg-paper text-forest",
        tone === "error" && "border-coral/35 bg-coral/10 text-coral",
        tone === "info" && "border-ink/20 bg-paper text-ink/68"
      )}
    >
      {message}
    </p>
  );
}

export function Field({
  label,
  children,
  help,
  labelCopyKey,
  helpCopyKey
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  help?: string;
  labelCopyKey?: string;
  helpCopyKey?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{typeof label === "string" ? <EditableCopy copyKey={labelCopyKey} fallback={label} /> : label}</span>
      {children}
      {help ? <span className="text-xs font-normal leading-5 text-ink/56"><EditableCopy copyKey={helpCopyKey} fallback={help} /></span> : null}
    </label>
  );
}

export const inputClass = "focus-ring w-full border border-ink/30 bg-chalk/80 px-3 py-2 text-sm text-ink";

export function formatFileSize(value?: number) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
