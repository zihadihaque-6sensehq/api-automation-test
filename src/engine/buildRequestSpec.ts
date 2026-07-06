import type { Settings } from "../config.js";
import type { TestCase } from "../sheetClient.js";
import { pickRecordField } from "../sheetColumnUtils.js";
import { worksheetToCollectionSlug } from "./ensureModuleCollection.js";
import { buildHoppscotchTestScript } from "../hoppscotch/buildHoppscotchTestScript.js";
import { parseExpectedResult } from "../testParser.js";
import {
  buildTestPayload,
  payloadToHoppscotchBody,
  payloadToRequestVariables,
} from "./buildTestPayload.js";
import { parseQueryParams, resolveTestValue } from "./parseTestData.js";
import { parseEndpoint, endpointUsesBearer } from "./parseEndpoint.js";

export interface RequestSpec {
  testId: string;
  title: string;
  method: string;
  url: string;
  useBearerAuth: boolean;
  body: string;
  params: Array<{ key: string; value: string; active: boolean }>;
  description: string;
  requestVariables: Array<{ key: string; value: string; active: boolean }>;
  preRequestScript: string;
  testScript: string;
}

const PRE_REQUEST_SCRIPT = [
  "// Hoppscotch pre-request script (pw namespace)",
  "// Request variables are substituted into URL/body at run time.",
].join("\n");

export function buildRequestSpecs(tests: TestCase[], settings: Settings): RequestSpec[] {
  return tests.map((testCase) => buildRequestSpec(testCase, settings));
}

export function buildRequestSpec(testCase: TestCase, settings: Settings): RequestSpec {
  const env = credentialEnv(settings);
  const expected = parseExpectedResult(testCase.expectedResult);
  const endpointRaw =
    testCase.endpoint ||
    pickRecordField(testCase.raw, settings.sheetColumns.endpointColumns);
  const { method, url, access } = parseEndpoint(
    endpointRaw,
    settings.loginEndpoint ? `POST ${settings.loginEndpoint}` : ""
  );
  const useBearerAuth = endpointUsesBearer(access);
  const shortName =
    testCase.raw["Test Case"] ?? testCase.raw["Test Scenario"] ?? testCase.testId;

  const queryRaw =
    testCase.queryParameters ||
    pickRecordField(testCase.raw, settings.sheetColumns.queryParameterColumns);
  const queryFields = method === "GET" ? parseQueryParams(queryRaw) : {};
  const bodyPayload =
    method === "GET" || isEmptyTestData(testCase.testData)
      ? {}
      : buildTestPayload(testCase.testData, env);

  const params = Object.entries(queryFields).map(([key, value]) => ({
    key,
    value: resolveTestValue(value, env, key),
    active: true,
  }));

  const variables = payloadToRequestVariables(bodyPayload);
  for (const [key, value] of Object.entries(env)) {
    if (!variables.some((item) => item.key.toUpperCase() === key.toUpperCase())) {
      variables.push({ key, value, active: true });
    }
  }

  return {
    testId: testCase.testId,
    title: `${testCase.testId} - ${shortName}`,
    method,
    url,
    useBearerAuth,
    body: method === "GET" ? "" : payloadToHoppscotchBody(bodyPayload, method),
    params,
    description: [
      "Automated API test (Google Sheet).",
      `Sheet row: ${testCase.rowNumber}`,
      `Endpoint: ${endpointRaw || url}`,
      testCase.queryParameters ? `Query: ${testCase.queryParameters}` : "",
      `Expected: ${testCase.expectedResult}`,
      "",
      "Scripts: Hoppscotch pw namespace.",
    ]
      .filter(Boolean)
      .join("\n"),
    requestVariables: variables,
    preRequestScript: PRE_REQUEST_SCRIPT,
    testScript: buildHoppscotchTestScript(testCase.testId, shortName, expected, {
      saveBearerTokenOnSuccess: shouldSaveBearerToken(url, access, expected),
    }),
  };
}

function shouldSaveBearerToken(
  url: string,
  access: ReturnType<typeof parseEndpoint>["access"],
  expected: ReturnType<typeof parseExpectedResult>
): boolean {
  if (access !== "public" || !expected.token) return false;
  const wantToken = ["present", "true", "yes", "exists"].includes(expected.token.toLowerCase());
  if (!wantToken) return false;
  return (
    url.includes("<<LOGIN_ENDPOINT>>") ||
    /\/auth\/|\/login|sign-in|signin/i.test(url)
  );
}

function isEmptyTestData(raw: string): boolean {
  const text = (raw || "").trim().toLowerCase();
  return !text || text === "n/a" || text === "na" || text === "-";
}

function credentialEnv(settings: Settings): Record<string, string> {
  return {
    EMAIL: settings.email,
    PASSWORD: settings.password,
    emailAddress: settings.email,
    password: settings.password,
    BASE_URL: settings.baseUrl,
    LOGIN_ENDPOINT: settings.loginEndpoint,
    VALID_EMAIL: settings.email,
    VALID_PASSWORD: settings.password,
  };
}

export function requestTitleMatchesTestId(
  title: string,
  testId: string,
  worksheet?: string
): boolean {
  const normalized = title.trim();

  if (worksheet) {
    const slug = worksheetToCollectionSlug(worksheet);
    const prefix = `${slug}/${testId}`;
    if (
      normalized.startsWith(`${prefix} -`) ||
      normalized.startsWith(`${prefix} `) ||
      normalized === prefix
    ) {
      return true;
    }
  }

  return (
    normalized.startsWith(`${testId} -`) ||
    normalized.startsWith(`${testId} `) ||
    normalized === testId
  );
}
