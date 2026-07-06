const PLACEHOLDER_PATTERN = /\{\{?\s*(\w+)\s*\}?\}|\$\{(\w+)\}/g;

export function stripCellQuotes(value: string): string {
  let text = value.trim();
  while (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text.replace(/\\"/g, '"').replace(/,\s*$/, "").trim();
}

export function normalizeFieldKey(key: string): string {
  const cleaned = stripCellQuotes(key).trim();
  const lowered = cleaned.toLowerCase().replace(/[\s_-]+/g, "");
  if (["email", "emailaddress"].includes(lowered)) return "emailAddress";
  if (lowered === "password") return "password";
  if (lowered === "displayname") return "displayName";
  return cleaned;
}

export function sanitizePayloadRecord(record: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(record)) {
    const key = normalizeFieldKey(rawKey);
    if (!key) continue;
    payload[key] = stripCellQuotes(String(rawValue));
  }
  return payload;
}

function parseJsonObject(text: string): Record<string, string> | null {
  const attempts = [text.trim()];
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && /["']?[\w]+\s*["']?\s*:/.test(trimmed)) {
    attempts.push(`{${trimmed}}`);
  }

  for (const candidate of attempts) {
    try {
      const data = JSON.parse(candidate) as unknown;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return sanitizePayloadRecord(
          Object.fromEntries(
            Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        );
      }
    } catch {
      // try next
    }
  }

  return null;
}

export function parseQueryParams(raw: string): Record<string, string> {
  const text = (raw || "").trim();
  if (!text) return {};

  if (text.includes(";") && /;\s*[\w]+\s*:/.test(text)) {
    const result: Record<string, string> = {};
    for (const part of text.split(/;\s*/)) {
      const trimmed = part.trim();
      if (!trimmed.includes(":")) continue;
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      if (key) result[key] = stripCellQuotes(value);
    }
    if (Object.keys(result).length) return result;
  }

  return parseKeyValueCell(text);
}

export function parseKeyValueCell(raw: string): Record<string, string> {
  const text = (raw || "").trim();
  if (!text) return {};

  const fromJson = parseJsonObject(text);
  if (fromJson && Object.keys(fromJson).length) return fromJson;

  const parts = /,\s*["']?[\w]+\s*["']?\s*:/.test(text)
    ? text.split(/,\s*(?=["']?[\w]+\s*["']?\s*:)/)
    : text.split(/\r?\n/).length
      ? text.split(/\r?\n/)
      : [text];

  const result: Record<string, string> = {};
  for (const part of parts) {
    const trimmed = part.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) continue;
    if (trimmed.includes(":")) {
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      const normalizedKey = normalizeFieldKey(key);
      if (normalizedKey) result[normalizedKey] = stripCellQuotes(value);
    } else if (trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      const normalizedKey = normalizeFieldKey(key);
      if (normalizedKey) result[normalizedKey] = stripCellQuotes(rest.join("=").trim());
    }
  }

  return result;
}

export function resolveTestValue(value: string, env: Record<string, string>, field = ""): string {
  const text = stripCellQuotes(value);
  if (text.toLowerCase() === "empty") return "";
  if (
    field.toLowerCase().includes("email") &&
    ["valid", "valid email", "registered email"].includes(text.toLowerCase())
  ) {
    return env.EMAIL ?? env.emailAddress ?? text;
  }
  if (
    field.toLowerCase().includes("password") &&
    ["valid", "valid password"].includes(text.toLowerCase())
  ) {
    return env.PASSWORD ?? text;
  }

  const resolved = text.replace(PLACEHOLDER_PATTERN, (match, g1, g2) => {
    const key = g1 || g2;
    if (env[key]) return env[key];
    if (env[key.toUpperCase()]) return env[key.toUpperCase()];
    return match;
  });

  if (env[resolved]) return env[resolved];
  if (env[resolved.toUpperCase()]) return env[resolved.toUpperCase()];
  return resolved;
}

export function payloadLooksMalformed(payload: Record<string, string>): boolean {
  return Object.keys(payload).some((key) => key.includes('"') || key.includes("\\"));
}
