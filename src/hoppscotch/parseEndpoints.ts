import type { HoppscotchEndpoint } from "./types.js";

interface HoppscotchRequestNode {
  name?: string;
  method?: string;
  endpoint?: string;
  headers?: Array<{ key?: string; value?: string; active?: boolean }>;
  body?: { body?: unknown; contentType?: string } | unknown;
  params?: Array<{ key?: string; value?: string; active?: boolean }>;
  request?: string | HoppscotchRequestNode;
}

interface HoppscotchFolderNode {
  name?: string;
  title?: string;
  folders?: HoppscotchFolderNode[];
  requests?: HoppscotchRequestNode[];
}

export function parseHoppscotchExport(raw: string): HoppscotchEndpoint[] {
  const data = JSON.parse(raw) as unknown;
  const endpoints: HoppscotchEndpoint[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      walkCollection(item, "", endpoints);
    }
    return endpoints;
  }

  walkCollection(data, "", endpoints);
  return endpoints;
}

function walkCollection(node: unknown, folderPath: string, endpoints: HoppscotchEndpoint[]): void {
  if (!node || typeof node !== "object") return;

  const collection = node as HoppscotchFolderNode & { requests?: HoppscotchRequestNode[] };
  const name =
    typeof collection.name === "string"
      ? collection.name
      : typeof collection.title === "string"
        ? collection.title
        : "";
  const currentPath = name ? (folderPath ? `${folderPath} / ${name}` : name) : folderPath;

  for (const rawRequest of collection.requests ?? []) {
    const request = normalizeRequestNode(rawRequest);
    const endpoint = requestToEndpoint(request, currentPath);
    if (endpoint) endpoints.push(endpoint);
  }

  for (const folder of collection.folders ?? []) {
    walkCollection(folder, currentPath, endpoints);
  }
}

function normalizeRequestNode(raw: HoppscotchRequestNode): HoppscotchRequestNode {
  if (typeof raw.request === "string") {
    try {
      return JSON.parse(raw.request) as HoppscotchRequestNode;
    } catch {
      return raw;
    }
  }
  if (raw.request && typeof raw.request === "object") {
    return raw.request;
  }
  return raw;
}

function requestToEndpoint(
  request: HoppscotchRequestNode,
  folderPath: string
): HoppscotchEndpoint | null {
  const name = request.name?.trim();
  const method = request.method?.trim().toUpperCase();
  const url = request.endpoint?.trim();

  if (!name || !method || !url) return null;

  const headers: Record<string, string> = {};
  for (const header of request.headers ?? []) {
    if (header.active === false) continue;
    if (header.key) headers[header.key] = header.value ?? "";
  }

  const body = extractBody(request.body);

  return { name, method, url, headers, body, folderPath };
}

function extractBody(bodyField: HoppscotchRequestNode["body"]): string | null {
  if (bodyField == null) return null;

  if (typeof bodyField === "object" && bodyField !== null && "body" in bodyField) {
    return normalizeBodyValue((bodyField as { body?: unknown }).body);
  }

  return normalizeBodyValue(bodyField);
}

function normalizeBodyValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    return value.length ? JSON.stringify(value) : null;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
