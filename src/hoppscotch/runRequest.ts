import type { ApiResponse } from "../apiClient.js";
import type { HoppscotchSettings } from "./config.js";
import { hoppscotchCliOptions } from "./config.js";
import { runHoppscotchCliJson } from "./runCli.js";

interface HoppscotchRequestRecord {
  id: string;
  title: string;
  request: string;
}

interface ParsedHoppscotchRequest {
  method: string;
  endpoint: string;
  headers?: Array<{ key: string; value: string; active?: boolean }>;
  params?: Array<{ key: string; value: string; active?: boolean }>;
  body?: { body?: string; contentType?: string };
  auth?: { authActive?: boolean; authType?: string; token?: string };
}

function parseRequestJson(requestStr: string): ParsedHoppscotchRequest | null {
  try {
    return JSON.parse(requestStr) as ParsedHoppscotchRequest;
  } catch {
    return null;
  }
}

function applyVariables(value: string, variables: Record<string, string>): string {
  let result = value;

  for (const [key, replacement] of Object.entries(variables)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`<<${escaped}>>`, "gi"), replacement);
    result = result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, "gi"), replacement);
  }

  return result;
}

function resolveUrl(endpoint: string, variables: Record<string, string>): string {
  let url = applyVariables(endpoint, variables).trim();

  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }

  return url;
}

function buildHeaders(
  reqData: ParsedHoppscotchRequest,
  variables: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (Array.isArray(reqData.headers)) {
    for (const header of reqData.headers) {
      if (header.active === false) continue;
      headers[header.key] = applyVariables(header.value, variables);
    }
  }

  if (reqData.auth?.authActive && reqData.auth.authType === "bearer" && reqData.auth.token) {
    headers.Authorization = `Bearer ${applyVariables(reqData.auth.token, variables)}`;
  }

  return headers;
}

function appendQueryParams(
  url: string,
  reqData: ParsedHoppscotchRequest,
  variables: Record<string, string>
): string {
  const urlObj = new URL(url);

  if (Array.isArray(reqData.params)) {
    for (const param of reqData.params) {
      if (param.active === false) continue;
      urlObj.searchParams.append(param.key, applyVariables(param.value, variables));
    }
  }

  return urlObj.toString();
}

export function hoppscotchVarsFromPayload(
  payload: Record<string, string>,
  baseUrl: string,
  loginEndpoint?: string
): Record<string, string> {
  const email = payload.emailAddress ?? payload.EMAIL ?? "";
  const password = payload.password ?? payload.PASSWORD ?? "";

  return {
    base_url: baseUrl.replace(/\/$/, ""),
    BASE_URL: baseUrl.replace(/\/$/, ""),
    LOGIN_ENDPOINT: loginEndpoint ?? "/auth/login",
    EMAIL: email,
    PASSWORD: password,
    emailAddress: email,
    password,
  };
}

export async function runHoppscotchRequest(
  requestId: string,
  variables: Record<string, string>,
  hoppscotch: HoppscotchSettings
): Promise<ApiResponse> {
  try {
    const record = runHoppscotchCliJson<HoppscotchRequestRecord>(
      ["request", "get", requestId],
      hoppscotchCliOptions(hoppscotch)
    );

    const reqData = parseRequestJson(record.request);
    if (!reqData) {
      return {
        statusCode: 0,
        body: null,
        rawText: "",
        error: `Failed to parse Hoppscotch request ${requestId}`,
      };
    }

    const url = appendQueryParams(resolveUrl(reqData.endpoint, variables), reqData, variables);
    const headers = buildHeaders(reqData, variables);
    let body = reqData.body?.body ?? "";

    if (typeof body === "string" && body.length) {
      body = applyVariables(body, variables);
    }

    const method = (reqData.method ?? "GET").toUpperCase();
    const fetchOpts: RequestInit = { method, headers };

    if (["POST", "PUT", "PATCH"].includes(method) && body) {
      fetchOpts.body = body;
      if (!headers["Content-Type"] && reqData.body?.contentType) {
        headers["Content-Type"] = reqData.body.contentType;
      }
    }

    const response = await fetch(url, fetchOpts);
    const rawText = await response.text();
    let parsedBody: unknown = rawText;

    if (rawText.trim()) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    }

    return {
      statusCode: response.status,
      body: parsedBody,
      rawText,
      error: null,
    };
  } catch (error) {
    return {
      statusCode: 0,
      body: null,
      rawText: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
