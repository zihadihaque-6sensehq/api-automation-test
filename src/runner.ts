import type { ExpectedAssertions } from "./testParser.js";
import type { TestCase } from "./sheetClient.js";

export interface ApiResponse {
  statusCode: number;
  body: unknown;
  rawText: string;
  error: string | null;
}

export interface TestResult {
  testCase: TestCase;
  payload: Record<string, string>;
  expected: ExpectedAssertions;
  response: ApiResponse;
  hoppscotchRequestId: string | null;
  passed: boolean;
  failures: string[];
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
