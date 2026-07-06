export interface RequestJUnitResult {
  suiteName: string;
  testId: string | null;
  passed: boolean;
  failures: string[];
  assertionCount: number;
}

const TEST_ID_PATTERN = /\b(TC[-_]\d+)\b/i;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeXmlEntities(match[1]) : null;
}

function extractTestId(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = candidate.match(TEST_ID_PATTERN);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function collectIssueMessages(testcaseBlock: string): string[] {
  const issues: string[] = [];
  const issuePattern = /<(failure|error)\b[^>]*(?:\/>|>[\s\S]*?<\/\1>)/gi;

  let match: RegExpExecArray | null;
  while ((match = issuePattern.exec(testcaseBlock)) !== null) {
    const tag = match[0];
    const openingTag = tag.slice(0, tag.indexOf(">") + 1);
    const message = extractAttribute(openingTag, "message");
    const bodyMatch = tag.match(/>([\s\S]*?)<\/(?:failure|error)>/i);
    const body = bodyMatch ? decodeXmlEntities(bodyMatch[1].trim()) : "";
    issues.push(message ? `${message}${body ? `: ${body}` : ""}` : body || "Assertion failed");
  }

  return issues;
}

function iterTestcaseBlocks(suiteBlock: string): string[] {
  const blocks: string[] = [];
  const pattern = /<testcase\b[^>]*(?:\/>|>[\s\S]*?<\/testcase>)/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(suiteBlock)) !== null) {
    blocks.push(match[0]);
  }

  return blocks;
}

function suiteTestsAttribute(suiteOpeningTag: string): number | null {
  const raw = extractAttribute(suiteOpeningTag, "tests");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

const EXPECTED_ASSERTION_PREFIX = "Expected '";
const EXPECTED_ASSERTION_MIDDLE = "' to be '";

function parseExpectedAssertion(raw: string): { actual: string; expected: string } | null {
  const start = raw.indexOf(EXPECTED_ASSERTION_PREFIX);
  if (start < 0) return null;

  const from = start + EXPECTED_ASSERTION_PREFIX.length;
  const middle = raw.indexOf(EXPECTED_ASSERTION_MIDDLE, from);
  if (middle < 0) return null;

  return {
    actual: raw.slice(from, middle),
    expected: raw.slice(middle + EXPECTED_ASSERTION_MIDDLE.length, raw.lastIndexOf("'")),
  };
}

export function formatJUnitFailure(raw: string): string {
  const parsed = parseExpectedAssertion(raw);
  if (!parsed) return raw.trim();

  const { actual, expected } = parsed;
  if (actual === expected) return raw.trim();

  if (
    actual.startsWith("HTTP ") ||
    actual.startsWith("error:") ||
    actual.startsWith("no ") ||
    actual.startsWith("access token")
  ) {
    return `${actual} — expected ${expected}`;
  }

  return `Got ${actual} — expected ${expected}`;
}

export function formatJUnitFailures(failures: string[]): string[] {
  const formatted = failures.map((failure) => {
    const testcasePrefix = failure.indexOf(": Expected '");
    const text =
      testcasePrefix >= 0 ? failure.slice(testcasePrefix + 2) : failure;
    return formatJUnitFailure(text);
  });

  return [...new Set(formatted.filter(Boolean))];
}

export function failuresForSheetComment(failures: string[]): string[] {
  const formatted = formatJUnitFailures(failures);
  const httpFailure = formatted.find((item) => item.startsWith("HTTP "));
  if (!httpFailure) return formatted.slice(0, 3);

  const rest = formatted.filter((item) => item !== httpFailure);
  return [httpFailure, ...rest].slice(0, 3);
}

export function parseJUnitReport(xml: string): RequestJUnitResult[] {
  const suites: RequestJUnitResult[] = [];
  const suitePattern = /<testsuite\b[^>]*>[\s\S]*?<\/testsuite>/gi;

  let suiteMatch: RegExpExecArray | null;
  while ((suiteMatch = suitePattern.exec(xml)) !== null) {
    const suiteBlock = suiteMatch[0];
    const openingTag = suiteBlock.slice(0, suiteBlock.indexOf(">") + 1);
    const suiteName = extractAttribute(openingTag, "name") ?? "unknown";
    const testcaseBlocks = iterTestcaseBlocks(suiteBlock);

    const failures: string[] = [];
    let assertionCount = testcaseBlocks.length;

    for (const testcaseBlock of testcaseBlocks) {
      const testcaseOpening = testcaseBlock.slice(0, testcaseBlock.indexOf(">") + 1);
      const testcaseName = extractAttribute(testcaseOpening, "name");
      const issues = collectIssueMessages(testcaseBlock);

      for (const issue of issues) {
        failures.push(testcaseName ? `${testcaseName}: ${issue}` : issue);
      }
    }

    if (!assertionCount) {
      assertionCount = suiteTestsAttribute(openingTag) ?? 0;
    }

    suites.push({
      suiteName,
      testId: extractTestId(suiteName),
      passed: failures.length === 0 && assertionCount > 0,
      failures,
      assertionCount,
    });
  }

  return suites;
}
