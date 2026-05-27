export function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isPlainRecord) : [];
}

export function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function textValues(value: unknown) {
  return Array.isArray(value) ? value.map(textValue).filter(Boolean) : [];
}

export function numberValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function numberValues(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}
