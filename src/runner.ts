import type { ApiResponse } from "./apiClient.js";
import { evaluateResponse } from "./apiClient.js";
import type { Settings } from "./config.js";
import type { HoppscotchSettings } from "./hoppscotch/config.js";
import { findRequestIdForTest, listCollectionRequests } from "./hoppscotch/requestMap.js";
import { hoppscotchVarsFromPayload, runHoppscotchRequest } from "./hoppscotch/runRequest.js";
import { SheetClient, type TestCase } from "./sheetClient.js";
import { buildLoginPayload, parseExpectedResult, type ExpectedAssertions } from "./testParser.js";

export interface TestResult {
  testCase: TestCase;
  payload: Record<string, string>;
  expected: ExpectedAssertions;
  response: ApiResponse;
  hoppscotchRequestId: string | null;
  passed: boolean;
  failures: string[];
}

export async function runLoginTests(
  settings: Settings,
  hoppscotch: HoppscotchSettings
): Promise<TestResult[]> {
  const client = new SheetClient(settings);
  const tests = await client.fetchApiTests();
  const skipped = await client.countSkippedNonBackendTests();
  const hoppscotchRequests = listCollectionRequests(hoppscotch);

  if (skipped) {
    console.log(
      `Skipping ${skipped} non-backend test(s) (only Category: ${settings.testCategoriesLabel}).`
    );
  }
  console.log(
    `Running ${tests.length} Hoppscotch test(s) (Category: ${settings.testCategoriesLabel}).`
  );

  const env = credentialEnv(settings);
  const results: TestResult[] = [];

  for (const testCase of tests) {
    const payload = buildLoginPayload(testCase.testData, env);
    const expected = parseExpectedResult(testCase.expectedResult);
    const requestId = findRequestIdForTest(testCase.testId, hoppscotchRequests);

    if (!requestId) {
      const failures = [
        `No Hoppscotch request found for ${testCase.testId} in collection ${hoppscotch.collectionId}. Run npm run sync-sign-in-endpoints first.`,
      ];
      results.push({
        testCase,
        payload,
        expected,
        response: { statusCode: 0, body: null, rawText: "", error: failures[0] },
        hoppscotchRequestId: null,
        passed: false,
        failures,
      });

      if (settings.writeResults) {
        await client.updateApiTestResult(testCase.rowNumber, false, failures);
      }
      continue;
    }

    const response = await runHoppscotchRequest(
      requestId,
      hoppscotchVarsFromPayload(payload, settings.baseUrl, settings.loginEndpoint),
      hoppscotch
    );
    const { passed, failures } = evaluateResponse(response, expected);

    results.push({
      testCase,
      payload,
      expected,
      response,
      hoppscotchRequestId: requestId,
      passed,
      failures,
    });

    if (settings.writeResults) {
      await client.updateApiTestResult(testCase.rowNumber, passed, failures);
    }
  }

  return results;
}

export function summarize(results: TestResult[]): { total: number; passed: number; failed: number } {
  const passed = results.filter((result) => result.passed).length;
  return { total: results.length, passed, failed: results.length - passed };
}

export function resultsToJson(results: TestResult[]): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      summary: summarize(results),
      results: results.map(serializeResult),
    },
    null,
    2
  );
}

function credentialEnv(settings: Settings): Record<string, string> {
  return {
    EMAIL: settings.email,
    PASSWORD: settings.password,
    emailAddress: settings.email,
    password: settings.password,
    VALID_EMAIL: settings.email,
    VALID_PASSWORD: settings.password,
  };
}

function serializeResult(result: TestResult): Record<string, unknown> {
  return {
    test_id: result.testCase.testId,
    row_number: result.testCase.rowNumber,
    category: result.testCase.category,
    passed: result.passed,
    failures: result.failures,
    payload: result.payload,
    expected: {
      status: result.expected.status,
      error: result.expected.error,
      token: result.expected.token,
      accept_statuses: result.expected.acceptStatuses,
    },
    hoppscotch_request_id: result.hoppscotchRequestId,
    response: {
      status_code: result.response.statusCode,
      body: result.response.body,
      error: result.response.error,
    },
  };
}
