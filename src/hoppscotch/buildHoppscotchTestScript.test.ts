import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHoppscotchTestScript } from "./buildHoppscotchTestScript.js";
import { NO_RESPONSE_LABEL } from "../httpStatus.js";

describe("buildHoppscotchTestScript", () => {
  it("uses humanized no-response label when pw.response.status is 0", () => {
    const script = buildHoppscotchTestScript("TC_001", "connection test", {
      status: 200,
      error: null,
      token: null,
      acceptStatuses: [],
    });

    assert.match(script, /var noResponseLabel = '/);
    assert.match(script, /status === 0 \? noResponseLabel : 'HTTP ' \+ status/);
    assert.match(script, new RegExp(NO_RESPONSE_LABEL.replace(/[()]/g, "\\$&")));
    assert.doesNotMatch(script, /var statusLine = 'HTTP ' \+ status/);
  });
});
