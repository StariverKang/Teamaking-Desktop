export function previewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  return String(value);
}

export function rowsFromData(data: any) {
  if (!data) return [];
  return Object.entries(data).filter(([, value]) => Array.isArray(value)) as [string, any[]][];
}
