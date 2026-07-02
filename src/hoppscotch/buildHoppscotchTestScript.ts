import type { ExpectedAssertions } from "../testParser.js";

export function buildHoppscotchTestScript(
  testId: string,
  title: string,
  expected: ExpectedAssertions
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
      `  var ok = [${statusCodes.join(", ")}].indexOf(pw.response.status) !== -1;`,
      "  pw.expect(ok).toBe(true);",
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
      "  var token = body.accessToken || body.token || body.access_token;",
      "  if (body.data) token = token || body.data.accessToken || body.data.token;",
      wantToken
        ? "  pw.expect(typeof token === 'string' && token.length > 0).toBe(true);"
        : "  pw.expect(!token).toBe(true);",
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
      "  var msg = String(body.message || body.error || '').toLowerCase();",
      `  pw.expect(/${pattern}/i.test(msg)).toBe(true);`,
      "});",
      ""
    );
  }

  return lines.join("\n");
}
