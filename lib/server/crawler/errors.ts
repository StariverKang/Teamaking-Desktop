export function crawlerErrorSummary(text: string, fallback?: string | null) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const explicitError = lines.find((line) => /^Error(?:\s+\[[^\]]+\])?:/i.test(line));
  if (explicitError) return explicitError;
  const codeLine = lines.find((line) => /\bERR_[A-Z0-9_]+\b/.test(line));
  if (codeLine) return codeLine;
  const throwLine = lines.find((line) => line.startsWith("throw "));
  if (throwLine) return throwLine;
  const nonVersionTail = [...lines].reverse().find((line) => !/^Node\.js v/i.test(line));
  return nonVersionTail || fallback || "";
}
