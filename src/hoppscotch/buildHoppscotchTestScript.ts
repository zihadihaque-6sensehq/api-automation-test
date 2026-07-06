import type { ExpectedAssertions } from "../testParser.js";

export interface BuildHoppscotchTestScriptOptions {
  saveBearerTokenOnSuccess?: boolean;
}

export function buildHoppscotchTestScript(
  testId: string,
  title: string,
  expected: ExpectedAssertions,
  options?: BuildHoppscotchTestScriptOptions
): string {
  const label = `${testId}: ${title}`;
  const lines: string[] = [
    "// Hoppscotch post-request tests (pw namespace)",
    "function responseJson() {",
    "  try {",
    "    var body = pw.response.body;",
    "    if (typeof body === 'string') return JSON.parse(body);",
    "    return body || {};",
    "  } catch (e) { return {}; }",
    "}",
    "function responseError(body) {",
    "  if (!body || typeof body !== 'object') return '';",
    "  var msg = body.message || body.error || '';",
    "  if (Array.isArray(body.errors) && body.errors.length) {",
    "    msg = body.errors.map(function (e) { return String(e); }).join('; ');",
    "  }",
    "  return String(msg).trim();",
    "}",
    "function responseToken(body) {",
    "  if (!body || typeof body !== 'object') return null;",
    "  var token = body.accessToken || body.token || body.access_token;",
    "  if (body.data && typeof body.data === 'object') {",
    "    token = token || body.data.accessToken || body.data.token || body.data.access_token;",
    "  }",
    "  return token;",
    "}",
    "function expectMatch(actual, expected) {",
    "  pw.expect(actual).toBe(expected);",
    "}",
    "",
  ];

  const statusCodes =
    expected.status !== null
      ? [expected.status]
      : expected.acceptStatuses.length
        ? expected.acceptStatuses
        : null;

  if (statusCodes?.length) {
    lines.push(
      `pw.test("${label} - HTTP status", () => {`,
      `  var allowed = [${statusCodes.join(", ")}];`,
      "  var status = pw.response.status;",
      "  var body = responseJson();",
      "  var apiMsg = responseError(body);",
      "  var errorName = body && body.error ? String(body.error) : '';",
      "  var expectedLine = 'HTTP ' + allowed.join(' or ');",
      "  var statusLine = 'HTTP ' + status + (errorName ? ' (' + errorName + ')' : '');",
      "  if (apiMsg) statusLine += ': ' + apiMsg;",
      "  var actual = allowed.indexOf(status) !== -1 ? expectedLine : statusLine;",
      "  expectMatch(actual, expectedLine);",
      "});",
      ""
    );
  }

  if (expected.token !== null) {
    const wantToken = ["present", "true", "yes", "exists"].includes(
      expected.token.toLowerCase()
    );
    lines.push(
      `pw.test("${label} - token", () => {`,
      "  var body = responseJson();",
      "  var token = responseToken(body);",
      "  var hasToken = typeof token === 'string' && token.length > 0;",
      wantToken
        ? [
            "  var expectedLine = 'access token present';",
            "  var actual = hasToken ? expectedLine : 'no access token in response (HTTP ' + pw.response.status + ')';",
            "  expectMatch(actual, expectedLine);",
          ].join("\n")
        : [
            "  var expectedLine = 'no access token';",
            "  var actual = hasToken ? 'access token unexpectedly present' : expectedLine;",
            "  expectMatch(actual, expectedLine);",
          ].join("\n"),
      "});",
      ""
    );
  }

  if (expected.error) {
    const pattern = expected.error
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean)
      .join("|");
    lines.push(
      `pw.test("${label} - error message", () => {`,
      "  var body = responseJson();",
      "  var msg = responseError(body).toLowerCase();",
      `  var pattern = /${pattern}/i;`,
      `  var expectedLine = 'error matching /${pattern}/i';`,
      "  var actual = msg ? 'error: ' + msg : 'no error message in response (HTTP ' + pw.response.status + ')';",
      "  expectMatch(pattern.test(msg) ? expectedLine : actual, expectedLine);",
      "});",
      ""
    );
  }

  if (!lines.some((line) => line.includes("pw.test("))) {
    lines.push(
      `pw.test("${label} - assertion configured", () => {`,
      "  expectMatch(",
      "    'no assertion rules parsed from Expected Result column',",
      "    'configure status code or token/error expectations in the sheet'",
      "  );",
      "});",
      ""
    );
  }

  if (options?.saveBearerTokenOnSuccess) {
    lines.push(
      "try {",
      "  var body = responseJson();",
      "  var token = responseToken(body);",
      "  if (pw.response.status >= 200 && pw.response.status < 300 && typeof token === 'string' && token.length) {",
      "    pw.env.set('bearer_token', token);",
      "    pw.env.set('BEARER_TOKEN', token);",
      "  }",
      "} catch (e) {}",
      ""
    );
  }

  return lines.join("\n");
}
