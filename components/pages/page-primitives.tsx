"use client";

export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="border border-coral/35 bg-coral/10 px-4 py-3 text-sm text-coral">{message}</div>;
}

export function Field({
  label,
  children,
  help
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {help ? <span className="text-xs font-normal leading-5 text-ink/56">{help}</span> : null}
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
