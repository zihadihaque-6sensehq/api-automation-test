import axios from "axios";
import type { Settings } from "./config.js";
import type { ExpectedAssertions } from "./testParser.js";

export interface ApiResponse {
  statusCode: number;
  body: unknown;
  rawText: string;
  error: string | null;
}

export async function postLogin(
  settings: Settings,
  payload: Record<string, unknown>
): Promise<ApiResponse> {
  try {
    const response = await axios.post(settings.loginUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 30_000,
      validateStatus: () => true,
    });

    return {
      statusCode: response.status,
      body: response.data,
      rawText: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
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

export function evaluateResponse(
  response: ApiResponse,
  expected: ExpectedAssertions
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  const allowedStatuses =
    expected.status !== null ? [expected.status] : expected.acceptStatuses;

  if (allowedStatuses.length && !allowedStatuses.includes(response.statusCode)) {
    failures.push(
      `Expected HTTP status ${allowedStatuses.join(", ")}, got ${response.statusCode}`
    );
  }

  if (expected.error) {
    const actualError = extractErrorMessage(response.body);
    const patterns = expected.error.split("|").map((part) => part.trim()).filter(Boolean);
    const matched = patterns.some(
      (pattern) => actualError?.toLowerCase().includes(pattern.toLowerCase())
    );

    if (!actualError || !matched) {
      failures.push(
        `Expected error containing one of [${patterns.join(", ")}], got '${actualError ?? response.rawText}'`
      );
    }
  }

  if (expected.token !== null) {
    const hasToken = hasTokenInBody(response.body);
    const wantToken = ["present", "true", "yes", "exists"].includes(expected.token);
    if (wantToken && !hasToken) failures.push("Expected token in response, but none was found");
    if (!wantToken && hasToken) {
      failures.push("Expected no token in response, but one was found");
    }
  }

  if (
    !failures.length &&
    expected.status === null &&
    !expected.acceptStatuses.length &&
    expected.error === null &&
    expected.token === null
  ) {
    failures.push("No assertions defined for expected result");
  }

  return { passed: failures.length === 0, failures };
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body ? String(body) : null;
  }

  const record = body as Record<string, unknown>;
  for (const key of ["message", "error", "errors"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value) && value.length) {
      return value.map((item) => String(item)).join("; ");
    }
  }

  return null;
}

function hasTokenInBody(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  const record = body as Record<string, unknown>;
  const token = record.token ?? record.accessToken ?? record.access_token;

  if (typeof token === "string") return token.trim().length > 0;
  if (token) return true;

  const data = record.data;
  if (data && typeof data === "object") return hasTokenInBody(data);
  return false;
}
