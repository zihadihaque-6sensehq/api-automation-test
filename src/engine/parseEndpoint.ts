export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type EndpointAccess = "public" | "protected";

export interface ParsedEndpoint {
  method: HttpMethod;
  url: string;
  access: EndpointAccess;
}

const METHOD_PATTERN = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i;
const ACCESS_PATTERN = /^(public|protected)\b/i;

export function parseEndpoint(raw: string, fallbackPath = ""): ParsedEndpoint {
  const text = (raw || fallbackPath || "").trim();
  if (!text) {
    return { method: "POST", url: "<<BASE_URL>><<LOGIN_ENDPOINT>>", access: "public" };
  }

  const { access, remainder } = extractAccess(text);
  const parsed = parseMethodAndUrl(remainder);

  return { ...parsed, access };
}

function extractAccess(text: string): { access: EndpointAccess; remainder: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length && ACCESS_PATTERN.test(lines[0])) {
    return {
      access: lines[0].toLowerCase() as EndpointAccess,
      remainder: lines.slice(1).join(" ").trim(),
    };
  }

  const inline = text.match(/^(public|protected)\s+/i);
  if (inline) {
    return {
      access: inline[1].toLowerCase() as EndpointAccess,
      remainder: text.slice(inline[0].length).trim(),
    };
  }

  return { access: "public", remainder: text };
}

function parseMethodAndUrl(text: string): Pick<ParsedEndpoint, "method" | "url"> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { method: "POST", url: "<<BASE_URL>><<LOGIN_ENDPOINT>>" };
  }

  const methodMatch = trimmed.match(METHOD_PATTERN);
  if (methodMatch) {
    const method = methodMatch[1].toUpperCase() as HttpMethod;
    const rest = trimmed.slice(methodMatch[0].length).trim();
    return { method, url: normalizeUrl(rest) };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { method: "GET", url: trimmed };
  }

  return { method: "POST", url: normalizeUrl(trimmed) };
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `<<BASE_URL>>${trimmed}`;
  if (trimmed.includes("<<") || trimmed.includes("{{")) return trimmed;
  return `<<BASE_URL>>/${trimmed.replace(/^\//, "")}`;
}

export function endpointUsesBearer(access: EndpointAccess): boolean {
  return access === "protected";
}
