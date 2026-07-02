import path from "path";
import type { Settings } from "../config.js";
import { PROJECT_ROOT } from "../config.js";
import type { TestCase } from "../sheetClient.js";
import { buildLoginPayload, parseExpectedResult } from "../testParser.js";
import { buildHoppscotchTestScript } from "./buildHoppscotchTestScript.js";

export interface SignInRequestSpec {
  testId: string;
  title: string;
  method: "POST";
  url: string;
  body: string;
  description: string;
  requestVariables: Array<{ key: string; value: string; active: boolean }>;
  preRequestScript: string;
  testScript: string;
}

const SHORT_NAMES: Record<string, string> = {
  TC_010: "Sign in valid",
  TC_011: "Wrong password",
  TC_012: "Unregistered email",
  TC_013: "Email with spaces",
  TC_014: "Failed login error",
  TC_015: "Valid login after fix",
  TC_016: "API success with token",
  TC_017: "Invalid email format",
  TC_018: "Invalid credentials",
};

const PRE_REQUEST_SCRIPT = [
  "// Hoppscotch pre-request script (pw namespace)",
  "// EMAIL and PASSWORD come from request variables substituted into body.",
].join("\n");

export function buildSignInRequestSpecs(
  tests: TestCase[],
  settings: Settings
): SignInRequestSpec[] {
  return tests.map((testCase) => {
    const resolvedPayload = buildLoginPayload(testCase.testData, {
      EMAIL: settings.email,
      PASSWORD: settings.password,
      emailAddress: settings.email,
      password: settings.password,
    });
    const expected = parseExpectedResult(testCase.expectedResult);
    const shortName = SHORT_NAMES[testCase.testId] ?? testCase.raw["Test Case"] ?? testCase.testId;

    return {
      testId: testCase.testId,
      title: `${testCase.testId} - ${shortName}`,
      method: "POST",
      url: "<<BASE_URL>><<LOGIN_ENDPOINT>>",
      body: JSON.stringify(
        {
          emailAddress: "<<EMAIL>>",
          password: "<<PASSWORD>>",
        },
        null,
        2
      ),
      description: [
        "Automated sign-in API test (Google Sheet).",
        `Sheet row: ${testCase.rowNumber}`,
        `Test case: ${testCase.raw["Test Case"] ?? ""}`,
        `Expected: ${testCase.expectedResult}`,
        "",
        "Scripts: Hoppscotch pw namespace (not Postman pm).",
      ].join("\n"),
      requestVariables: [
        { key: "EMAIL", value: resolvedPayload.emailAddress, active: true },
        { key: "PASSWORD", value: resolvedPayload.password, active: true },
      ],
      preRequestScript: PRE_REQUEST_SCRIPT,
      testScript: buildHoppscotchTestScript(testCase.testId, shortName, expected),
    };
  });
}

export function requestTitleMatchesTestId(title: string, testId: string): boolean {
  const normalized = title.trim();
  return (
    normalized.startsWith(`${testId} -`) ||
    normalized.startsWith(`${testId} `) ||
    normalized === testId
  );
}
