

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

export function parseCommaText(value: unknown) {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  return textValue(value).split(",").map((item) => item.trim()).filter(Boolean);
}

export function parseJsonObject(value: unknown) {
  if (isPlainRecord(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isPlainRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
