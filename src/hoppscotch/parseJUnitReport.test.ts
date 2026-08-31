import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatJUnitFailure } from "./parseJUnitReport.js";
import { NO_RESPONSE_LABEL } from "../httpStatus.js";

describe("formatJUnitFailure", () => {
  it("rewrites HTTP 0 actuals to human-readable no-response text", () => {
    const raw = "Expected 'HTTP 0' to be 'HTTP 200'";
    assert.equal(
      formatJUnitFailure(raw),
      `${NO_RESPONSE_LABEL} — expected HTTP 200`
    );
  });

  it("rewrites HTTP 0 with suffix to human-readable no-response text", () => {
    const raw = "Expected 'HTTP 0 (ECONNREFUSED): connection refused' to be 'HTTP 200'";
    assert.equal(
      formatJUnitFailure(raw),
      `${NO_RESPONSE_LABEL} (ECONNREFUSED): connection refused — expected HTTP 200`
    );
  });

  it("keeps non-zero HTTP statuses unchanged", () => {
    const raw = "Expected 'HTTP 400' to be 'HTTP 200'";
    assert.equal(formatJUnitFailure(raw), "HTTP 400 — expected HTTP 200");
  });
});
