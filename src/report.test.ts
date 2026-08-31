import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TestCase } from "./sheetClient.js";
import { formatResultActual } from "./report.js";
import { NO_RESPONSE_LABEL } from "./httpStatus.js";
import type { TestResult } from "./runner.js";

function makeResult(
  overrides: Partial<TestResult["response"]> & { statusCode: number }
): TestResult {
  const testCase: TestCase = {
    rowNumber: 1,
    testId: "TC_001",
    category: "API",
    endpoint: "/login",
    queryParameters: "",
    testData: "",
    expectedResult: "HTTP 200",
    apiStatus: "",
    status: "",
    raw: { "Test Case": "Sample test" },
  };

  return {
    testCase,
    payload: {},
    expected: {
      status: 200,
      error: null,
      token: null,
      acceptStatuses: [],
    },
    response: {
      statusCode: overrides.statusCode,
      body: overrides.body ?? null,
      rawText: overrides.rawText ?? "",
      error: overrides.error ?? null,
    },
    hoppscotchRequestId: null,
    passed: false,
    failures: [],
  };
}

describe("formatResultActual", () => {
  it("omits HTTP 0 and shows humanized label when statusCode is 0 with no error or rawText", () => {
    const actual = formatResultActual(makeResult({ statusCode: 0 }));
    assert.equal(actual, NO_RESPONSE_LABEL);
    assert.doesNotMatch(actual, /HTTP 0/);
  });

  it("shows error when statusCode is 0 and error is set", () => {
    const actual = formatResultActual(
      makeResult({ statusCode: 0, error: "connection refused" })
    );
    assert.equal(actual, "connection refused");
    assert.doesNotMatch(actual, /HTTP 0/);
  });

  it("shows rawText when statusCode is 0 and rawText is set", () => {
    const actual = formatResultActual(
      makeResult({ statusCode: 0, rawText: "timeout after 30s" })
    );
    assert.equal(actual, "timeout after 30s");
  });

  it("appends body when statusCode is 0 and body is present", () => {
    const actual = formatResultActual(
      makeResult({ statusCode: 0, body: { message: "partial" } })
    );
    assert.equal(actual, `${NO_RESPONSE_LABEL}\n{"message":"partial"}`);
  });

  it("renders HTTP status and body for positive statusCode", () => {
    const actual = formatResultActual(
      makeResult({ statusCode: 200, body: { ok: true } })
    );
    assert.equal(actual, "HTTP 200\n{\"ok\":true}");
  });
});
