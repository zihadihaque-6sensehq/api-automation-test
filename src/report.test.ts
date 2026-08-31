import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatActualResponse } from "./report.js";
import type { ApiResponse } from "./runner.js";

function response(overrides: Partial<ApiResponse> = {}): ApiResponse {
  return {
    statusCode: 0,
    body: null,
    rawText: "",
    error: null,
    ...overrides,
  };
}

describe("formatActualResponse", () => {
  it("shows a friendly message when statusCode is 0 with no error", () => {
    assert.equal(
      formatActualResponse(response()),
      "No HTTP response (connection failed or request did not complete)"
    );
  });

  it("appends normalized error text when statusCode is 0", () => {
    assert.equal(
      formatActualResponse(
        response({ error: "HTTP 0 — expected HTTP 201" })
      ),
      "No HTTP response (connection failed or request did not complete)\nexpected HTTP 201"
    );
  });

  it("appends body when statusCode is 0 and there is no error", () => {
    assert.equal(
      formatActualResponse(response({ body: { message: "timeout" } })),
      'No HTTP response (connection failed or request did not complete)\n{"message":"timeout"}'
    );
  });

  it("preserves HTTP status and body when statusCode is greater than 0", () => {
    assert.equal(
      formatActualResponse(
        response({ statusCode: 404, body: { error: "Not found" } })
      ),
      'HTTP 404\n{"error":"Not found"}'
    );
  });

  it("preserves HTTP status and error when statusCode is greater than 0", () => {
    assert.equal(
      formatActualResponse(
        response({ statusCode: 500, error: "Internal Server Error" })
      ),
      "HTTP 500\nInternal Server Error"
    );
  });
});
